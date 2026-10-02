import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ArchiveStore } from '../../services/archive.store';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './perspectra-character.page.html'
})
export class PerspectraCharacterPage {
  readonly store = inject(ArchiveStore);

  readonly auth = inject(AuthService);

  private router = inject(Router);

  private route = inject(ActivatedRoute);

  public get character() {
    return this.route.snapshot.paramMap.get('characterId') ?? '';
  }

  public get chapters() {
    const rows = this.store.transcripts().filter((t) =>
      t.category === 'perspectra'
      && this.slug(t.parentLabel) === this.character);
    const map = new Map<string, { id: string; label: string }>();
    rows.forEach((t) => {
      const label = t.stageLabel || t.title;
      map.set(this.slug(label), {
        id: this.slug(label),
        label
      });
    }); return [...map.values()];
  }

  public editCharacter() {
    const next = prompt('Character name', this.character);
    if (!next?.trim() || next.trim() === this.character) {
      return;
    }
    this.rows().forEach((t) =>
      this.store.update({
        ...t, parentLabel: next.trim(),
        parentId: this.slug(next.trim())
      }));
    this.router.navigate(['/perspectra', this.slug(next.trim())]);
  }

  public deleteCharacter() {
    if (confirm('Delete this character and all its parts?')) {
      this.rows().forEach((t) => this.store.remove(t.id));
    }
  }

  private rows() {
    return this.store.transcripts().filter((t) =>
      t.category === 'perspectra' && this.slug(t.parentLabel) === this.character);
  }


  private slug(value: string) { return value.toLowerCase().trim().replace(/\s+/g, '-'); }
}
