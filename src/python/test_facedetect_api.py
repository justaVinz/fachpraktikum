import os
import unittest
from unittest.mock import patch, MagicMock
from io import BytesIO
from facedetect_api import app, photos_dir

class FaceDetectApiTests(unittest.TestCase):
  def setUp(self):
    self.app = app.test_client()
    self.app.testing = True
    self.user_id = 'test_user'
    self.img_name = f'{self.user_id}.png'
    self.img_path = os.path.join(photos_dir, self.img_name)

  @patch('os.path.isfile')
  def test_check_image_exists(self, mock_isfile):

    photos_dir = os.path.join(parent_dir, 'app/lib/photos')
    print(f"Photos directory: {photos_dir}")

    # Mock os.path.isfile to return True
    mock_isfile.return_value = True
    response = self.app.get(f'/check/{self.user_id}')
    data = response.get_json()

    self.assertEqual(response.status_code, 200)
    self.assertTrue(data['exists'])
    self.assertEqual(data['message'], 'Bild existiert.')

  @patch('os.path.isfile')
  def test_check_image_not_exists(self, mock_isfile):
    # Mock os.path.isfile to return False
    mock_isfile.return_value = False
    response = self.app.get(f'/check/{self.user_id}')
    data = response.get_json()

    self.assertEqual(response.status_code, 404)
    self.assertFalse(data['exists'])
    self.assertEqual(data['message'], 'Bild existiert nicht.')

  @patch('cv2.VideoCapture')
  @patch('cv2.imwrite')
  @patch('os.path.join', return_value='test_img_path.png')
  @patch('os.path.isfile', return_value=False)
  def test_capture_image(self, mock_isfile, mock_os_path_join, mock_imwrite, mock_videocapture):
    mock_camera = MagicMock()
    mock_camera.isOpened.return_value = True
    mock_camera.read.return_value = (True, MagicMock())
    mock_videocapture.return_value = mock_camera

    response = self.app.post(f'/capture/{self.user_id}')
    data = response.get_json()

    self.assertEqual(response.status_code, 200)
    self.assertEqual(data['message'], 'Bild wurde aufgenommen und gespeichert.')
    self.assertEqual(data['img_path'], 'test_img_path.png')

  @patch('cv2.VideoCapture')
  @patch('os.path.isfile', return_value=True)
  def test_capture_image_already_exists(self, mock_isfile, mock_videocapture):
    response = self.app.post(f'/capture/{self.user_id}')
    data = response.get_json()

    self.assertEqual(response.status_code, 200)
    self.assertEqual(data['message'], 'Bild bereits vorhanden.')

  @patch('cv2.VideoCapture')
  @patch('cv2.imread')
  def test_detect_face_recognized(self, mock_imread, mock_videocapture):
    # Mock control image and live frame
    mock_control_img = MagicMock()
    mock_frame = MagicMock()
    mock_imread.return_value = mock_control_img

    mock_camera = MagicMock()
    mock_camera.isOpened.return_value = True
    mock_camera.read.return_value = (True, mock_frame)
    mock_videocapture.return_value = mock_camera

    with patch('face_recognition.face_encodings', return_value=[MagicMock()]), \
      patch('face_recognition.compare_faces', return_value=[True]):
      response = self.app.post(f'/detect/{self.user_id}')
      data = response.get_json()

      self.assertEqual(response.status_code, 200)
      self.assertTrue(data['recognized'])
      self.assertEqual(data['message'], 'Gesichter sind identisch')

  @patch('cv2.VideoCapture')
  @patch('cv2.imread')
  def test_detect_face_not_recognized(self, mock_imread, mock_videocapture):
    # Mock control image and live frame
    mock_control_img = MagicMock()
    mock_frame = MagicMock()
    mock_imread.return_value = mock_control_img

    mock_camera = MagicMock()
    mock_camera.isOpened.return_value = True
    mock_camera.read.return_value = (True, mock_frame)
    mock_videocapture.return_value = mock_camera

    with patch('face_recognition.face_encodings', return_value=[MagicMock()]), \
      patch('face_recognition.compare_faces', return_value=[False]):
      response = self.app.post(f'/detect/{self.user_id}')
      data = response.get_json()

      self.assertEqual(response.status_code, 200)
      self.assertFalse(data['recognized'])
      self.assertEqual(data['message'], 'Gesichter sind nicht indentisch.')

if __name__ == '__main__':
  unittest.main()
