import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ArchiveStore } from '../../services/archive.store';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { Router } from '@angular/router';
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
  templateUrl: './perspectra-character.page.html',
})
export class PerspectraCharacterPage {
  readonly store = inject(ArchiveStore);

  readonly auth = inject(AuthService);

  readonly language = inject(LanguageService);

  private confirmation = inject(ConfirmationService);

  public renameDialogVisible = false;

  public renameValue = '';

  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  private router = inject(Router);

  private route = inject(ActivatedRoute);

  public get breadcrumbItems(): MenuItem[] {
    return [
      { label: this.language.text('perspectra'), routerLink: '/perspectra' },
      { label: this.characterName },
    ];
  }

  public get character() {
    return this.route.snapshot.paramMap.get('characterId') ?? '';
  }

  public get characterRecord() {
    return this.store.chapters().find(
      (item) => item.category === 'perspectra' && this.slug(item.name) === this.character,
    );
  }

  public get characterName() {
    return this.characterRecord?.name ?? this.rows()[0]?.parentLabel ?? this.character;
  }

  public get chapters() {
    const rows = this.store
      .transcripts()
      .filter((t) => t.category === 'perspectra' && this.slug(t.parentLabel) === this.character);
    const map = new Map<string, { id: string; label: string }>();
    rows.forEach((t) => {
      const label = t.stageLabel || t.title;
      map.set(this.slug(label), {
        id: this.slug(label),
        label,
      });
    });
    return [...map.values()];
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
    const parts = this.rows();
    const renameParts = () => {
      parts.forEach((t) => this.store.update({ ...t, parentLabel: next }));
      this.router.navigate(['/perspectra', this.slug(next)]);
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
      key: 'perspectra-character-actions',
      header: 'Delete character?',
      message: 'Delete this character and all its parts?',
      icon: 'pi pi-trash',
      acceptLabel: 'Delete character',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const removeParts = () => {
          this.rows().forEach((t) => this.store.remove(t.id));
          this.router.navigate(['/perspectra']);
        };
        if (this.characterRecord) {
          this.store.removeChapter(this.characterRecord.id, removeParts);
        } else {
          removeParts();
        }
      },
    });
  }

  private rows() {
    return this.store
      .transcripts()
      .filter((t) => t.category === 'perspectra' && this.slug(t.parentLabel) === this.character);
  }

  private slug(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
