import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, defer, from, map, of, tap } from 'rxjs';
import { SUPABASE_CLIENT } from './supabase.client';

export interface AuthUser {
  id: string;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  public readonly user = signal<AuthUser | null>(null);

  constructor() {
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.user.set(this.toUser(session?.user ?? null));
    });
  }

  public me(): Observable<AuthUser | null> {
    return defer(() => from(this.supabase.auth.getSession())).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.toUser(data.session?.user ?? null);
      }),
      tap((user) => this.user.set(user)),
      catchError(() => {
        this.user.set(null);
        return of(null);
      }),
    );
  }

  public login(email: string, password: string): Observable<AuthUser> {
    return from(this.supabase.auth.signInWithPassword({ email, password })).pipe(
      map(({ data, error }) => {
        if (error || !data.user) throw error ?? new Error('Supabase did not return a user.');
        const user = this.toUser(data.user);
        if (!user) throw new Error('Supabase returned no authenticated user.');
        return user;
      }),
      tap((user) => this.user.set(user)),
    );
  }

  public logout(): Observable<void> {
    return from(this.supabase.auth.signOut()).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      tap(() => this.user.set(null)),
    );
  }

  private toUser(
    user: {
      id: string;
      email?: string | null;
      user_metadata?: Record<string, unknown>;
    } | null,
  ): AuthUser | null {
    if (!user) return null;
    const username =
      typeof user.user_metadata?.['username'] === 'string'
        ? user.user_metadata['username']
        : (user.email ?? user.id);
    return { id: user.id, username };
  }
}
