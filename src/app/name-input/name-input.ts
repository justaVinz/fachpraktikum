import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-name-input',
  templateUrl: './name-input.component.html',
  styleUrls: ['./name-input.component.css']
})
export class NameInputComponent implements OnInit {
  name: string = '';

  constructor(private router: Router) { }

  ngOnInit(): void {
    // Initialisierungscode falls erforderlich
  }

  submitName(): void {
    if (this.name.trim()) {
      this.router.navigate(['/meeting'], { queryParams: { name: this.name } });
    } else {
      alert('Please enter a name.');
    }
  }
}
