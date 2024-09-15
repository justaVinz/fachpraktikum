import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

// Bootstrappe das Angular-Modul (AppModule) und starte die Anwendung.
platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
