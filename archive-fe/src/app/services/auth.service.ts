import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';

export interface AuthUser {
  username: string;
  authorities: string[];
}
type MeResponse = AuthUser | { authenticated: false };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly url = 'http://localhost:8080/api/auth';

  public readonly user = signal<AuthUser | null>(null);

  public me(): Observable<AuthUser | null> {
    return this.http.get<MeResponse>(this.url + '/me', { withCredentials: true }).pipe(
      map((response): AuthUser | null => ('authenticated' in response ? null : response)),
      tap((user) => this.user.set(user)),
      catchError(() => {
        this.user.set(null);
        return of(null);
      }),
    );
  }

  public login(username: string, password: string): Observable<AuthUser> {
    return this.http
      .post<AuthUser>(this.url + '/login', { username, password }, { withCredentials: true })
      .pipe(tap((user) => this.user.set(user)));
  }

  public logout(): Observable<void> {
    return this.http
      .post<void>(this.url + '/logout', {}, { withCredentials: true })
      .pipe(tap(() => this.user.set(null)));
  }
}
