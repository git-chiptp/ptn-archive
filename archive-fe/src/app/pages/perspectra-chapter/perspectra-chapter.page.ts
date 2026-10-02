import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ArchiveStore } from '../../services/archive.store';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './perspectra-chapter.page.html'
})
export class PerspectraChapterPage {
  readonly store = inject(ArchiveStore); readonly auth = inject(AuthService); private router = inject(Router); private route = inject(ActivatedRoute);

  public get character() {
    return this.route.snapshot.paramMap.get('characterId') ?? '';
  }

  public get chapter() {
    return this.route.snapshot.paramMap.get('chapterId') ?? '';
  }

  public editChapter() {
    const next = prompt('Chapter name', this.chapter);
    if (!next?.trim() || next.trim() === this.chapter) {
      return;
    }
    this.parts.forEach((t) => this.store.update({ ...t, stageLabel: next.trim(), title: next.trim() }));
    this.router.navigate(['/perspectra', this.character, this.slug(next.trim())]);
  }

  public deleteChapter() {
    if (confirm('Delete this chapter and all its parts?')) {
      this.parts.forEach((t) => this.store.remove(t.id));
    }
  }

  private get parts() {
    return this.store.transcripts().filter((t) =>
      t.category === 'perspectra'
      && this.slug(t.parentLabel) === this.character
      && this.slug(t.stageLabel || t.title) === this.chapter
    );
  }

  public addPart() {
    this.router.navigate(['/add-transcript'], { queryParams: { category: 'perspectra', parentLabel: this.character, stageLabel: this.chapter } });
  }

  public deletePart(id: string) {
    if (confirm('Delete this part?')) {
      this.store.remove(id);
    }
  }

  private slug(value: string) {
    return value.toLowerCase().trim().replace(/\s+/g, '-');
  }
}
