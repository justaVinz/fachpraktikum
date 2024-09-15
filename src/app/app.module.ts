import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { RouterModule, Routes } from '@angular/router';
import { ToastrModule } from 'ngx-toastr';
import {MeetingComponent} from "./meeting/meeting.component";
import {NameInputComponent} from "./name-input/name-input.component";
import {AppRoutingModule} from "./app-routing.module";
import { ParticipantListComponent } from './participant-list/participant-list.component';
import {MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardTitle} from "@angular/material/card";


const routes: Routes = [
  { path: '', redirectTo: '/meeting', pathMatch: 'full' },
  { path: './meeting', component: MeetingComponent },
  { path: './name-input', component: NameInputComponent },
];

@NgModule({
  declarations: [
    AppComponent,
    MeetingComponent,
    NameInputComponent
  ],
  imports: [
    BrowserModule,
    ParticipantListComponent,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatInputModule,
    FormsModule,
    RouterModule.forRoot(routes),
    ToastrModule.forRoot(),
    MatCard,
    MatCardActions,
    MatCardContent,
    MatCardTitle,
    MatCardHeader,
    // Add ToastrModule here
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
