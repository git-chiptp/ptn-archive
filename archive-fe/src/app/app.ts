import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNavigationComponent } from './components/app-navigation/app-navigation.component';
import { AuthService } from './services/auth.service';

@Component({
  standalone: true,
  imports: [RouterOutlet, AppNavigationComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  host: {
    style: 'display: block; width: 100%; min-height: 100vh;',
  },
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly auth = inject(AuthService);

  constructor() {
    if (this.document.body) {
      this.document.body.style.margin = '0';
      this.document.body.style.minHeight = '100vh';
    }
    this.auth.me().subscribe();
    this.disableAutocomplete();
  }

  private disableAutocomplete() {
    const window = this.document.defaultView;
    if (!window || !this.document.body) {
      return;
    }
    const applyToControls = (root: ParentNode) => {
      root.querySelectorAll('form, input, textarea, select').forEach((element) => {
        const isPassword =
          element.tagName === 'INPUT' && (element as HTMLInputElement).type === 'password';
        element.setAttribute('autocomplete', isPassword ? 'new-password' : 'off');
      });
    };
    applyToControls(this.document);
    if (typeof window.MutationObserver !== 'function') {
      return;
    }
    const observer = new window.MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === window.Node.ELEMENT_NODE) {
            applyToControls(node as Element);
          }
        });
      });
    });
    observer.observe(this.document.body, { childList: true, subtree: true });
  }
}
