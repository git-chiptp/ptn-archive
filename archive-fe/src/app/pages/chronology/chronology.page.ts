import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { OrderListModule } from 'primeng/orderlist';
import { TextareaModule } from 'primeng/textarea';
import { TimelineModule } from 'primeng/timeline';
import { AuthService } from '../../services/auth.service';
import {
  ChronologyEntry,
  ChronologyInput,
  ChronologyService,
} from '../../services/chronology.service';
import { LanguageService } from '../../services/language.service';

type ChronologyDraft = Omit<ChronologyInput, 'displayOrder'>;

@Component({
  standalone: true,
  imports: [
    FormsModule,
    BreadcrumbModule,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    OrderListModule,
    TextareaModule,
    TimelineModule,
  ],
  templateUrl: './chronology.page.html',
  styleUrl: './chronology.page.css',
})
export class ChronologyPage {
  public readonly language = inject(LanguageService);
  public readonly auth = inject(AuthService);
  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  private readonly chronology = inject(ChronologyService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  public chronologyItems: ChronologyEntry[] = [];
  public orderedItems: ChronologyEntry[] = [];
  public selectedItem: ChronologyEntry | null = null;
  public editingItem: ChronologyEntry | null = null;
  public draft: ChronologyDraft = this.emptyDraft();
  public dialogVisible = false;
  public editorVisible = false;
  public organizerVisible = false;
  public loading = true;
  public saving = false;
  public orderSaving = false;
  public error = '';
  public dialogError = '';
  public status = '';

  constructor() {
    void this.load();
  }

  public get breadcrumbItems(): MenuItem[] {
    return [
      { label: this.language.text('mirrorSystem'), routerLink: '/mirror-system' },
      { label: this.language.text('chronology') },
    ];
  }

  public async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.chronologyItems = await this.chronology.list();
      this.orderedItems = [...this.chronologyItems];
    } catch {
      this.error = this.language.text('chronologyLoadFailed');
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  public openItem(item: ChronologyEntry): void {
    this.selectedItem = item;
    this.dialogVisible = true;
  }

  public closeDialog(): void {
    this.dialogVisible = false;
  }

  public openAdd(): void {
    if (!this.auth.user()) return;
    this.dialogError = '';
    this.status = '';
    this.editingItem = null;
    this.draft = this.emptyDraft();
    this.editorVisible = true;
  }

  public openEdit(item: ChronologyEntry): void {
    if (!this.auth.user()) return;
    this.dialogError = '';
    this.status = '';
    this.editingItem = item;
    this.draft = {
      date: item.date,
      title: item.title,
      detail: item.detail,
      icon: item.icon,
    };
    this.editorVisible = true;
  }

  public closeEditor(): void {
    if (!this.saving) this.editorVisible = false;
  }

  public async submit(): Promise<void> {
    const input: ChronologyInput = {
      date: this.draft.date.trim(),
      title: this.draft.title.trim(),
      detail: this.draft.detail.trim(),
      icon: this.draft.icon.trim(),
      displayOrder: this.editingItem?.displayOrder ?? this.chronologyItems.length,
    };
    this.dialogError = '';
    this.status = '';
    if (!input.title) {
      this.dialogError = this.language.text('chronologyRequired');
      return;
    }

    this.saving = true;
    try {
      const entry = this.editingItem
        ? await this.chronology.update(this.editingItem.id, input)
        : await this.chronology.create(input);
      this.chronologyItems = this.sortItems([
        ...this.chronologyItems.filter((item) => item.id !== entry.id),
        entry,
      ]);
      this.orderedItems = [...this.chronologyItems];
      this.editorVisible = false;
      this.status = this.language.text(
        this.editingItem ? 'chronologyUpdated' : 'chronologySaved',
      );
      this.editingItem = null;
    } catch {
      this.dialogError = this.language.text(
        this.editingItem ? 'chronologyUpdateFailed' : 'chronologySaveFailed',
      );
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  public deleteItem(item: ChronologyEntry): void {
    if (!this.auth.user()) return;
    this.confirmation.confirm({
      key: 'chronology-actions',
      header: this.language.text('chronologyDeleteEntry'),
      message: this.language.text('chronologyDeleteMessage', { name: item.title }),
      icon: 'pi pi-trash',
      acceptLabel: this.language.text('delete'),
      rejectLabel: this.language.text('cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        this.error = '';
        this.status = '';
        try {
          await this.chronology.remove(item.id);
          this.chronologyItems = this.chronologyItems.filter((entry) => entry.id !== item.id);
          this.orderedItems = this.orderedItems.filter((entry) => entry.id !== item.id);
          this.status = this.language.text('chronologyDeleted');
        } catch {
          this.error = this.language.text('chronologyDeleteFailed');
        } finally {
          this.changeDetector.markForCheck();
        }
      },
    });
  }

  public openOrganizer(): void {
    if (!this.auth.user()) return;
    this.status = '';
    this.orderedItems = [...this.chronologyItems];
    this.organizerVisible = true;
  }

  public closeOrganizer(): void {
    if (!this.orderSaving) this.organizerVisible = false;
  }

  public async saveOrder(): Promise<void> {
    this.orderSaving = true;
    this.error = '';
    try {
      await this.chronology.reorder(this.orderedItems.map((item) => item.id));
      this.chronologyItems = this.orderedItems.map((item, displayOrder) => ({
        ...item,
        displayOrder,
      }));
      this.organizerVisible = false;
      this.status = this.language.text('chronologyOrderSaved');
    } catch {
      this.error = this.language.text('chronologyOrderSaveFailed');
    } finally {
      this.orderSaving = false;
      this.changeDetector.markForCheck();
    }
  }

  public scrollToItem(event: MouseEvent, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
  }

  private emptyDraft(): ChronologyDraft {
    return {
      date: '',
      title: '',
      detail: '',
      icon: 'pi pi-bolt',
    };
  }

  private sortItems(items: ChronologyEntry[]): ChronologyEntry[] {
    return [...items].sort(
      (left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
    );
  }
}
