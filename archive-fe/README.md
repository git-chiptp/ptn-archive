# ArchiveFe

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.0.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Hosted static deployment

The frontend is deployed as a static Angular application, not SSR. The `public/_redirects` file keeps client-side routes working on direct navigation and refresh.

Set the hosted Supabase values only in the deployment environment, then build from `archive-fe`:

```bash
SUPABASE_URL='<hosted-project-url>' \
SUPABASE_PUBLISHABLE_KEY='<publishable-or-anon-key>' \
npm run build:hosted
```

`build:hosted` writes `public/runtime-config.js` before the production build. Only the hosted URL and publishable/anon key belong in this browser-visible file; never provide a service-role key, secret key, or database password. The hosted build fails if either required variable is missing or invalid.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
