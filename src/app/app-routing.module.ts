import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NameInputComponent } from './name-input/name-input.component';
import { MeetingComponent } from './meeting/meeting.component'; // Assume this is the main component for the meeting

const routes: Routes = [
  { path: '', redirectTo: '/name-input', pathMatch: 'full' },
  { path: 'name-input', component: NameInputComponent },
  { path: 'meeting', component: MeetingComponent },
  { path: '**', redirectTo: '/name-input' } // Redirect to name-input for unknown routes
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
