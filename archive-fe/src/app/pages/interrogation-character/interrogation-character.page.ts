import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ArchiveStore } from '../../services/archive.store';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { ButtonModule } from 'primeng/button';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    BreadcrumbModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
  ],
  templateUrl: './interrogation-character.page.html',
})
export class InterrogationCharacterPage {
  readonly store = inject(ArchiveStore);
  readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);

  private confirmation = inject(ConfirmationService);

  public renameDialogVisible = false;

  public renameValue = '';

  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  public get category(): 'interrogation' | 'mirage' {
    return this.route.snapshot.data['category'] === 'mirage' ? 'mirage' : 'interrogation';
  }

  public get actionKey() {
    return `${this.category}-actions`;
  }

  public get breadcrumbItems(): MenuItem[] {
    return [
      { label: this.language.text(this.category), routerLink: '/' + this.category },
      { label: this.characterName },
    ];
  }

  public get character() {
    return this.route.snapshot.paramMap.get('characterId') ?? '';
  }

  public get characterRecord() {
    return this.store.chapters().find(
      (item) => item.category === this.category && this.slug(item.name) === this.character,
    );
  }

  public get characterName() {
    return this.characterRecord?.name ?? this.parts[0]?.parentLabel ?? this.character;
  }

  public get parts() {
    return this.store
      .transcripts()
      .filter((t) => t.category === this.category && this.slug(t.parentLabel) === this.character);
  }

  public addPart() {
    this.router.navigate(['/add-transcript'], {
      queryParams: { category: this.category, parentLabel: this.characterName },
    });
  }

  public editCharacter() {
    this.renameValue = this.characterName;
    this.renameDialogVisible = true;
  }

  public cancelRename() {
    this.renameDialogVisible = false;
  }

  public saveRename() {
    const next = this.renameValue.trim();
    if (!next || next === this.characterName) {
      this.renameDialogVisible = false;
      return;
    }
    const parts = this.parts;
    const renameParts = () => {
      parts.forEach((t) => this.store.update({ ...t, parentLabel: next }));
      this.router.navigate(['/', this.category, this.slug(next)]);
    };
    if (this.characterRecord) {
      this.store.updateChapter({ ...this.characterRecord, name: next }, renameParts);
    } else {
      renameParts();
    }
    this.renameDialogVisible = false;
  }

  public deleteCharacter() {
    this.confirmation.confirm({
      key: this.actionKey,
      header: 'Delete character?',
      message: 'Delete this character and all its parts?',
      icon: 'pi pi-trash',
      acceptLabel: 'Delete character',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const removeParts = () => {
          this.parts.forEach((t) => this.store.remove(t.id));
          this.router.navigate(['/', this.category]);
        };
        if (this.characterRecord) {
          this.store.removeChapter(this.characterRecord.id, removeParts);
        } else {
          removeParts();
        }
      },
    });
  }

  public deletePart(id: string) {
    this.confirmation.confirm({
      key: this.actionKey,
      header: 'Delete part?',
      message: 'Delete this part?',
      icon: 'pi pi-trash',
      acceptLabel: 'Delete part',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.store.remove(id),
    });
  }

  public slug(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
