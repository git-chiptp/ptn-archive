import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ButtonModule } from 'primeng/button';
import { DataViewModule } from 'primeng/dataview';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ImageModule } from 'primeng/image';
import { Category, Chapter } from '../../models/transcript.models';
import { ArchiveStore } from '../../services/archive.store';
import { LanguageService } from '../../services/language.service';
import { MediaPickerComponent } from '../../components/media-picker/media-picker.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BreadcrumbModule,
    ConfirmDialogModule,
    ButtonModule,
    DataViewModule,
    InputTextModule,
    MessageModule,
    ImageModule,
    MediaPickerComponent,
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

  public chapterSaving = false;

  public chapterError = '';

  public mediaPickerVisible = false;

  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  public get category(): Category {
    const category = this.route.snapshot.queryParamMap.get('category');
    return category === 'eternal-nightmare' ||
      category === 'event-story' ||
      category === 'interrogation' ||
      category === 'mirage' ||
      category === 'perspectra'
      ? category
      : 'main-story';
  }

  public get isCharacter() {
    return (
      this.category === 'interrogation' ||
      this.category === 'mirage' ||
      this.category === 'perspectra'
    );
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
      {
        label: this.language.text(
          this.chapterEditingId
            ? 'edit'
            : 'add' + this.itemName.charAt(0).toUpperCase() + this.itemName.slice(1),
        ),
      },
    ];
  }

  public chapterForm: Chapter = {
    id: '',
    name: '',
    nameTranslations: {},
    backgroundImage: '',
    category: 'main-story',
  };

  public get isEvent() {
    return this.route.snapshot.queryParamMap.get('category') === 'event-story';
  }

  public get managedChapters() {
    return this.store
      .chapters()
      .filter((item) => (item.category ?? 'main-story') === this.category);
  }

  public get filteredChapters(): Chapter[] {
    const query = this.chapterSearch.trim().toLocaleLowerCase();
    return query
      ? this.managedChapters.filter((chapter) =>
          [chapter.name, ...Object.values(chapter.nameTranslations ?? {})].some((name) =>
            name.toLocaleLowerCase().includes(query),
          ),
        )
      : this.managedChapters;
  }

  public localizedName(chapter: Chapter): string {
    return this.store.localizedChapterName(chapter);
  }

  public setTranslation(languageCode: string, value: string) {
    this.chapterForm.nameTranslations = {
      ...(this.chapterForm.nameTranslations ?? {}),
      [languageCode]: value,
    };
  }

  public get translationLanguages() {
    if (this.category === 'interrogation') {
      return [];
    }
    return this.language.supportedLanguages.filter(({ code }) => code !== 'en');
  }

  constructor() {
    this.chapterForm.category = this.category;
    void this.store.ensureCategoryLoaded(this.category);
  }

  public editChapter(chapter: Chapter) {
    this.chapterError = '';
    this.chapterEditingId = chapter.id;
    this.chapterForm = {
      ...chapter,
      nameTranslations: { ...chapter.nameTranslations },
    };
  }

  public cancelChapterEdit() {
    this.chapterError = '';
    this.chapterEditingId = null;
    this.chapterForm = {
      id: '',
      name: '',
      nameTranslations: {},
      backgroundImage: '',
      category: this.category,
    };
  }

  public openMediaPicker() {
    this.mediaPickerVisible = true;
  }

  public mediaPicked(value: string) {
    this.chapterForm.backgroundImage = value;
    this.mediaPickerVisible = false;
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
      nameTranslations:
        this.category === 'interrogation'
          ? {}
          : Object.fromEntries(
              Object.entries(this.chapterForm.nameTranslations ?? {})
                .map(([language, name]) => [language, name.trim()])
                .filter(([, name]) => name),
            ),
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
      await this.store.updateChapter(
        chapter,
        () => {
          if (this.isCharacter && previous && previous.name !== chapter.name) {
            this.characterTranscripts(previous).forEach((transcript) =>
              this.store.update({ ...transcript, parentLabel: chapter.name }),
            );
          }
          done();
        },
        failed,
      );
    } else {
      await this.store.addChapter(chapter, done, failed);
    }
  }

  public deleteChapter(chapter: Chapter) {
    this.confirmation.confirm({
      key: 'chapter-actions',
      header:
        this.language.text(
          'delete' + this.itemName.charAt(0).toUpperCase() + this.itemName.slice(1),
        ) + '?',
      message: this.language.text('deleteNamed', { name: this.localizedName(chapter) }),
      icon: 'pi pi-trash',
      acceptLabel: this.language.text(
        'delete' + this.itemName.charAt(0).toUpperCase() + this.itemName.slice(1),
      ),
      rejectLabel: this.language.text('cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.firstChapter = 0;
        this.store.removeChapter(chapter.id, () => {
          if (this.isCharacter) {
            this.characterTranscripts(chapter).forEach((transcript) =>
              this.store.remove(transcript.id),
            );
          }
        });
      },
    });
  }

  private characterTranscripts(chapter: Chapter) {
    return this.store
      .transcripts()
      .filter(
        (transcript) =>
          transcript.category === this.category &&
          (transcript.parentId === chapter.id || transcript.parentLabel === chapter.name),
      );
  }
}
