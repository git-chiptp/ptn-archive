import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ButtonModule } from 'primeng/button';
import { DataViewModule } from 'primeng/dataview';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ImageModule } from 'primeng/image';
import { Category, Chapter } from '../../models/transcript.models';
import { ArchiveStore } from '../../services/archive.store';
import { LanguageService } from '../../services/language.service';
import { ArchiveStorageService } from '../../services/archive-storage.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BreadcrumbModule,
    ConfirmDialogModule,
    ButtonModule,
    DataViewModule,
    FileUploadModule,
    InputTextModule,
    MessageModule,
    ImageModule,
  ],
  templateUrl: './add-chapter.page.html',
})
export class AddChapterPage {
  readonly store = inject(ArchiveStore);

  readonly language = inject(LanguageService);

  private confirmation = inject(ConfirmationService);

  private route = inject(ActivatedRoute);

  public chapterEditingId: string | null = null;

  public chapterSearch = '';

  public firstChapter = 0;

  public backgroundFile?: File;

  public backgroundPreviewUrl = '';

  public chapterSaving = false;

  public chapterError = '';

  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  public get category(): Category {
    const category = this.route.snapshot.queryParamMap.get('category');
    return category === 'eternal-nightmare' || category === 'event-story' || category === 'interrogation' || category === 'mirage' || category === 'perspectra'
      ? category
      : 'main-story';
  }

  public get isCharacter() {
    return this.category === 'interrogation' || this.category === 'mirage' || this.category === 'perspectra';
  }

  public get itemName() {
    return this.isCharacter ? 'character' : this.isEvent ? 'event' : 'chapter';
  }

  public get categoryName() {
    return this.language.text(
      this.category === 'main-story'
        ? 'mainStory'
        : this.category === 'eternal-nightmare'
          ? 'eternalNightmare'
          : this.category === 'event-story'
            ? 'eventStory'
            : this.category,
    );
  }

  public get breadcrumbItems(): MenuItem[] {
    return [
      { label: this.categoryName, routerLink: '/' + this.category },
      { label: this.language.text(this.chapterEditingId ? 'edit' : 'add' + this.itemName.charAt(0).toUpperCase() + this.itemName.slice(1)) },
    ];
  }

  public chapterForm: Chapter = {
    id: '',
    name: '',
    backgroundImage: '',
    category: 'main-story'
  };

  public get isEvent() {
    return this.route.snapshot.queryParamMap.get('category') === 'event-story';
  }

  public get managedChapters() {
    return this.store.chapters().filter((item) => (item.category ?? 'main-story') === this.category);
  }

  public get filteredChapters(): Chapter[] {
    const query = this.chapterSearch.trim().toLocaleLowerCase();
    return query
      ? this.managedChapters.filter((chapter) => chapter.name.toLocaleLowerCase().includes(query))
      : this.managedChapters;
  }

  constructor() {
    this.chapterForm.category = this.category;
  }

  public editChapter(chapter: Chapter) {
    this.clearSelectedChapterImage();
    this.chapterError = '';
    this.chapterEditingId = chapter.id;
    this.chapterForm = { ...chapter };
    this.backgroundPreviewUrl = chapter.backgroundImage ?? '';
  }

  public cancelChapterEdit() {
    this.clearSelectedChapterImage();
    this.chapterError = '';
    this.chapterEditingId = null;
    this.chapterForm = {
      id: '',
      name: '',
      backgroundImage: '',
      category: this.category
    };
  }

  public onChapterImage(input: File[] | FileList | Event) {
    const file = Array.isArray(input)
      ? input[0]
      : 'target' in input
        ? (input.target as HTMLInputElement | null)?.files?.[0]
        : input.item(0) ?? undefined;
    if (!file) {
      return;
    }
    this.clearSelectedChapterImage();
    this.chapterError = '';
    this.backgroundFile = file;
    this.backgroundPreviewUrl = URL.createObjectURL(file);
  }

  public clearSelectedChapterImage() {
    if (this.backgroundPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.backgroundPreviewUrl);
    }
    this.backgroundFile = undefined;
    this.backgroundPreviewUrl = '';
  }

  public async submitChapter() {
    if (!this.chapterForm.name.trim() || this.chapterSaving) {
      return;
    }
    this.chapterSaving = true;
    this.chapterError = '';
    const chapter = {
      ...this.chapterForm,
      name: this.chapterForm.name.trim(),
    };
    const done = () => {
      this.chapterSaving = false;
      this.cancelChapterEdit();
    };
    const failed = () => {
      this.chapterSaving = false;
      this.chapterError = this.language.text('saveChapterFailed');
    };
    if (this.chapterEditingId) {
      const previous = this.managedChapters.find((item) => item.id === this.chapterEditingId);
      await this.store.updateChapter(chapter, () => {
        if (this.isCharacter && previous && previous.name !== chapter.name) {
          this.characterTranscripts(previous).forEach((transcript) =>
            this.store.update({ ...transcript, parentLabel: chapter.name }),
          );
        }
        done();
      }, this.backgroundFile, failed);
    } else {
      await this.store.addChapter(chapter, this.backgroundFile, done, failed);
    }
  }

  public deleteChapter(chapter: Chapter) {
    this.confirmation.confirm({
      key: 'chapter-actions',
      header: this.language.text('delete' + this.itemName.charAt(0).toUpperCase() + this.itemName.slice(1)) + '?',
      message: this.language.text('deleteNamed', { name: chapter.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.language.text('delete' + this.itemName.charAt(0).toUpperCase() + this.itemName.slice(1)),
      rejectLabel: this.language.text('cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.firstChapter = 0;
        this.store.removeChapter(chapter.id, () => {
          if (this.isCharacter) {
            this.characterTranscripts(chapter).forEach((transcript) => this.store.remove(transcript.id));
          }
        });
      },
    });
  }

  private characterTranscripts(chapter: Chapter) {
    return this.store.transcripts().filter(
      (transcript) =>
        transcript.category === this.category &&
        (transcript.parentId === chapter.id || transcript.parentLabel === chapter.name),
    );
  }
}
