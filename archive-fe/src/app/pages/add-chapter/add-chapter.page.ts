import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Chapter } from '../../models/transcript.models';
import { ArchiveStore } from '../../services/archive.store';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './add-chapter.page.html',
})
export class AddChapterPage {
  readonly store = inject(ArchiveStore);

  private route = inject(ActivatedRoute);

  public chapterEditingId: string | null = null;

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
    return this.store.chapters().filter((item) => (item.category ?? 'main-story') === (this.isEvent ? 'event-story' : 'main-story'));
  }

  constructor() {
    if (this.isEvent) {
      this.chapterForm.category = 'event-story';
    }
  }

  public editChapter(chapter: Chapter) {
    this.chapterEditingId = chapter.id; this.chapterForm = { ...chapter };
  }

  public cancelChapterEdit() {
    this.chapterEditingId = null;
    this.chapterForm = {
      id: '',
      name: '',
      backgroundImage: '',
      category: this.isEvent ? 'event-story' : 'main-story'
    };
  }

  public onChapterImage(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.chapterForm = {
      ...this.chapterForm,
      backgroundImage: String(reader.result)
    };
    reader.readAsDataURL(file);
  }

  public submitChapter() {
    if (!this.chapterForm.name.trim()) {
      return;
    }
    const chapter = {
      ...this.chapterForm,
      name: this.chapterForm.name.trim()
    };
    if (this.chapterEditingId) {
      this.store.updateChapter(chapter);
    } else {
      this.store.addChapter(chapter);
    }
    this.cancelChapterEdit();
  }

  public deleteChapter(chapter: Chapter) {
    if (confirm('Delete chapter "' + chapter.name + '"?')) {
      this.store.removeChapter(chapter.id);
    }
  }
}
