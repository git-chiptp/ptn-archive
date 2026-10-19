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
  templateUrl: './perspectra-chapter.page.html',
})
export class PerspectraChapterPage {
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
      { label: this.characterName, routerLink: ['/perspectra', this.character] },
      { label: this.chapterName },
    ];
  }

  public get character() {
    return this.route.snapshot.paramMap.get('characterId') ?? '';
  }

  public get chapter() {
    return this.route.snapshot.paramMap.get('chapterId') ?? '';
  }

  public get characterName() {
    return this.store.chapters().find(
      (item) => item.category === 'perspectra' && this.slug(item.name) === this.character,
    )?.name ?? this.parts[0]?.parentLabel ?? this.character;
  }

  public get chapterName() {
    return this.parts[0]?.stageLabel || this.parts[0]?.title || this.chapter;
  }

  public editChapter() {
    this.renameValue = this.chapterName;
    this.renameDialogVisible = true;
  }

  public cancelRename() {
    this.renameDialogVisible = false;
  }

  public saveRename() {
    const next = this.renameValue.trim();
    if (!next || next === this.chapterName) {
      this.renameDialogVisible = false;
      return;
    }
    this.parts.forEach((t) =>
      this.store.update({ ...t, stageLabel: next, title: next }),
    );
    this.renameDialogVisible = false;
    this.router.navigate(['/perspectra', this.character, this.slug(next)]);
  }

  public deleteChapter() {
    this.confirmation.confirm({
      key: 'perspectra-chapter-actions',
      header: 'Delete chapter?',
      message: 'Delete this chapter and all its parts?',
      icon: 'pi pi-trash',
      acceptLabel: 'Delete chapter',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.parts.forEach((t) => this.store.remove(t.id)),
    });
  }

  private get parts() {
    return this.store
      .transcripts()
      .filter(
        (t) =>
          t.category === 'perspectra' &&
          this.slug(t.parentLabel) === this.character &&
          this.slug(t.stageLabel || t.title) === this.chapter,
      );
  }

  public addPart() {
    this.router.navigate(['/add-transcript'], {
      queryParams: {
        category: 'perspectra',
        parentLabel: this.characterName,
        stageLabel: this.chapterName,
      },
    });
  }

  public deletePart(id: string) {
    this.confirmation.confirm({
      key: 'perspectra-chapter-actions',
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
