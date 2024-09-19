import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FaceRecognitionService {
  private apiUrl = 'http://localhost:5200';

  constructor(private http: HttpClient) { }

  captureImage(userId: string | undefined): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/capture/${userId}`, {});
  }

  checkImage(userId: string | undefined): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/check/${userId}`);
  }

  detectFace(userId: string | undefined): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/detect/${userId}`, {});
  }
}
