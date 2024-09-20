import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FaceRecognitionService {
  private apiUrl = 'http://localhost:5200';

  constructor(private http: HttpClient) { }

  /**
   * Sends a POST request to the server to capture an image for face recognition.
   * @param userId - The unique identifier of the user. If not provided, the server will handle it as an anonymous user.
   * @returns An Observable that emits the server's response. The response will contain the captured image data.
   * @throws Will throw an error if the server responds with an error status.
   */
  captureImage(userId: string | undefined): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/capture/${userId}`, {});
  }

  /**
   * Sends a GET request to the server to check if a face is already registered for the given user.
   * @param userId - The unique identifier of the user. If not provided, the server will handle it as an anonymous user.
   * @returns An Observable that emits the server's response. The response will contain information about whether a face is registered for the given user.
   * @throws Will throw an error if the server responds with an error status.
   */
  checkImage(userId: string | undefined): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/check/${userId}`);
  }

  /**
   * Sends a POST request to the server to detect a face in the captured image.
   * @param userId - The unique identifier of the user. If not provided, the server will handle it as an anonymous user.
   * @returns An Observable that emits the server's response. The response will contain information about the detected face.
   * @throws Will throw an error if the server responds with an error status.
   */
  detectFace(userId: string | undefined): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/detect/${userId}`, {});
  }
}
