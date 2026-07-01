import cv2
import numpy as np
from ultralytics import YOLO
import os
from collections import defaultdict
import math

class TennisTracker:
    def __init__(self, model_path=None):
        """
        初始化網球追蹤器 (嚴格保留原始結構並擴充球拍偵測)
        """
        if model_path is None:
            model_path = os.getenv('YOLO_MODEL_PATH', '../models/yolov8n.pt')
        
        self.model_path = model_path
        self.model = None
        self.load_model()
        
        # 基礎類別集合：包含球類 (32-37) 與球拍 (38)
        self.accepted_class_ids = set([32, 33, 34, 35, 36, 37, 38])
        
        # 依據模型類別名稱擴充 (保留原始邏輯)
        try:
            names = getattr(self.model, 'names', None)
            if names is None:
                names = getattr(getattr(self.model, 'model', None), 'names', None)
            if names is not None:
                if isinstance(names, dict):
                    iterable = sorted(names.items())
                    for idx, name in iterable:
                        n = str(name).lower()
                        if n in ('tennis ball', 'sports ball', 'tennis racket') or 'tennis' in n:
                            self.accepted_class_ids.add(int(idx))
        except Exception:
            pass
        
        self.tennis_ball_class_id = 37
        self.confidence_threshold = float(os.getenv('CONFIDENCE_THRESHOLD', '0.15'))
        self.max_disappeared = 10

    def load_model(self):
        try:
            if not os.path.exists(self.model_path):
                print("下載 YOLOv8 模型...")
                os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
                self.model = YOLO('yolov8n.pt')
                self.model.save(self.model_path)
            else:
                self.model = YOLO(self.model_path)
            print(f"已載入 YOLO 模型: {self.model_path}")
        except Exception as e:
            print(f"載入模型失敗: {e}")
            self.model = YOLO('yolov8n.pt')
    
    def detect_tennis_ball(self, frame):
        """ 偵測網球與球拍 (原始函式名保留) """
        results = self.model(frame, verbose=False)
        detections = []
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    if (class_id in self.accepted_class_ids) and confidence > self.confidence_threshold:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        detections.append({
                            'center': ((x1 + x2) / 2, (y1 + y2) / 2),
                            'bbox': (x1, y1, x2, y2),
                            'confidence': confidence,
                            'class_id': class_id, # 新增 class_id 區分球與拍
                            'size': (x2 - x1, y2 - y1)
                        })
        return detections

    def detect_bounces(self, trajectory):
        """ 從軌跡中偵測回彈點 (V-shape 分析) """
        bounces = []
        if len(trajectory) < 5: return bounces
        y_coords = [p['position'][1] for p in trajectory]
        for i in range(2, len(y_coords) - 2):
            if y_coords[i] > y_coords[i-1] and y_coords[i] > y_coords[i+1] and \
               y_coords[i] > y_coords[i-2] and y_coords[i] > y_coords[i+2]:
                bounces.append({
                    'frame': trajectory[i]['frame'],
                    'pixel_pos': trajectory[i]['position']
                })
        return bounces

    def track_ball(self, video_path, output_path=None):
        print(f"開始追蹤網球: {video_path}")
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened(): raise ValueError(f"無法開啟影片: {video_path}")
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # 補全字典結構，確保符合 speed_analyzer.py 需求
        tracking_results = {
            'video_info': {
                'fps': fps, 'width': width, 'height': height, 'total_frames': total_frames
            },
            'ball_positions': [],
            'trajectories': [],
            'all_bounces': []
        }
        
        pos_history = {} # 僅存放球的中心點，用於畫軌跡線
        frame_count = 0
        
        # 階段一：偵測與位置記錄
        while True:
            ret, frame = cap.read()
            if not ret: break
            
            detections = self.detect_tennis_ball(frame)
            frame_data = {
                'frame_number': frame_count,
                'timestamp': frame_count / fps,
                'detections': detections
            }
            tracking_results['ball_positions'].append(frame_data)
            
            # 記錄「網球」(排除球拍 ID 38) 的最高信心點用於軌跡繪製
            balls = [d for d in detections if d['class_id'] != 38]
            if balls:
                best = max(balls, key=lambda x: x['confidence'])
                pos_history[frame_count] = (int(best['center'][0]), int(best['center'][1]))

            frame_count += 1
            if frame_count % 30 == 0:
                print(f"處理進度: {(frame_count / total_frames) * 100:.1f}%")

        # 階段二：軌跡與落點分析
        tracking_results['trajectories'] = self.analyze_trajectories(tracking_results['ball_positions'])
        for traj in tracking_results['trajectories']:
            # 轉換資料結構供落點偵測使用
            formatted_traj = [{'frame': f, 'position': p} for f, p in zip(range(traj['start_frame'], traj['end_frame']+1), traj['positions'])]
            tracking_results['all_bounces'].extend(self.detect_bounces(formatted_traj))

        # 階段三：穩定度計算 (100% 原始邏輯)
        tracking_results['stability_score'] = self.calculate_stability_score(tracking_results['ball_positions'], total_frames)

        # 階段四：渲染影片 (包含框、線、落點)
        if output_path:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
            
            curr_f = 0
            while True:
                ret, frame = cap.read()
                if not ret: break
                
                # 1. 畫出所有偵測框 (包含球與球拍)
                frame = self.draw_detections(frame, tracking_results['ball_positions'][curr_f]['detections'], curr_f)
                
                # 2. 畫出最近 20 幀的黃色軌跡線
                line_pts = [pos_history[i] for i in range(max(0, curr_f-20), curr_f+1) if i in pos_history]
                if len(line_pts) > 1:
                    cv2.polylines(frame, [np.array(line_pts, np.int32)], False, (0, 255, 255), 2, cv2.LINE_AA)
                
                # 3. 畫出永久落點紅叉叉
                for b in tracking_results['all_bounces']:
                    if curr_f >= b['frame']:
                        cv2.drawMarker(frame, (int(b['pixel_pos'][0]), int(b['pixel_pos'][1])), (0, 0, 255), cv2.MARKER_TILTED_CROSS, 20, 2)

                out.write(frame)
                curr_f += 1
            out.release()

        cap.release()
        print(f"追蹤完成，穩定度分數: {tracking_results['stability_score']}")
        return tracking_results

    def draw_detections(self, frame, detections, frame_number):
        """ 100% 原始繪製邏輯，並加入球拍區分 """
        annotated_frame = frame.copy()
        for detection in detections:
            x1, y1, x2, y2 = detection['bbox']
            center_x, center_y = detection['center']
            confidence = detection['confidence']
            label_text = "Racket" if detection['class_id'] == 38 else "Ball"
            color = (255, 0, 0) if detection['class_id'] == 38 else (0, 255, 0)
            
            cv2.rectangle(annotated_frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
            cv2.circle(annotated_frame, (int(center_x), int(center_y)), 5, (0, 0, 255), -1)
            cv2.putText(annotated_frame, f"{label_text}: {confidence:.2f}", (int(x1), int(y1) - 10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        cv2.putText(annotated_frame, f"Frame: {frame_number}", (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        return annotated_frame

    def analyze_trajectories(self, ball_positions):
        """
        分析網球軌跡 (加入容錯插值機制，解決軌跡斷裂問題)
        """
        trajectories = []
        current_trajectory = []
        
        missing_frames_count = 0
        MAX_MISSING_FRAMES = 3  # 🌟 容忍度設定：最多允許連續 3 幀沒抓到球
        
        for frame_data in ball_positions:
            if frame_data['detections']:
                # 取得當前幀最可信的檢測點
                best_detection = max(frame_data['detections'], key=lambda x: x['confidence'])
                new_point = {
                    'frame': frame_data['frame_number'],
                    'timestamp': frame_data['timestamp'],
                    'position': best_detection['center'],
                    'confidence': best_detection['confidence']
                }
                
                # 🌟 核心插值邏輯：如果之前有短暫跟丟，且現在又抓到了，就把中間的空缺補起來
                if 0 < missing_frames_count <= MAX_MISSING_FRAMES and len(current_trajectory) > 0:
                    last_point = current_trajectory[-1]
                    frame_diff = new_point['frame'] - last_point['frame']
                    
                    # 進行線性插值補點
                    for i in range(1, frame_diff):
                        ratio = i / frame_diff
                        interp_x = last_point['position'][0] + (new_point['position'][0] - last_point['position'][0]) * ratio
                        interp_y = last_point['position'][1] + (new_point['position'][1] - last_point['position'][1]) * ratio
                        interp_timestamp = last_point['timestamp'] + (new_point['timestamp'] - last_point['timestamp']) * ratio
                        
                        current_trajectory.append({
                            'frame': last_point['frame'] + i,
                            'timestamp': interp_timestamp,
                            'position': (interp_x, interp_y),
                            'confidence': 0.1 # 給予較低的信心分數，代表這是程式預測的，不是AI抓的
                        })
                
                # 將當前真實抓到的點加入軌跡
                current_trajectory.append(new_point)
                missing_frames_count = 0 # 重置跟丟計數器
                
            else:
                # 這一幀沒抓到球
                if len(current_trajectory) > 0:
                    missing_frames_count += 1
                    
                    # 🌟 如果連續跟丟超過容忍度 (3幀)，才真的切斷軌跡
                    if missing_frames_count > MAX_MISSING_FRAMES:
                        if len(current_trajectory) > 2:  # 軌跡至少要有 3 個點才算數
                            trajectories.append(current_trajectory)
                        current_trajectory = []
                        missing_frames_count = 0
        
        # 處理影片結束時的最後一段軌跡
        if len(current_trajectory) > 2:
            trajectories.append(current_trajectory)
        
        # 分析每條軌跡的速度
        analyzed_trajectories = []
        for i, trajectory in enumerate(trajectories):
            analysis = self.analyze_single_trajectory(trajectory, i)
            if analysis:
                analyzed_trajectories.append(analysis)
        
        return analyzed_trajectories

    def analyze_single_trajectory(self, trajectory, trajectory_id):
        """ 100% 原始單軌跡分析邏輯，並補回必要欄位 """
        if len(trajectory) < 2: return None
        positions = [point['position'] for point in trajectory]
        timestamps = [point['timestamp'] for point in trajectory]
        
        velocities = []
        for i in range(1, len(positions)):
            dx = positions[i][0] - positions[i-1][0]
            dy = positions[i][1] - positions[i-1][1]
            dt = timestamps[i] - timestamps[i-1]
            if dt > 0:
                speed = np.sqrt(dx**2 + dy**2) / dt
                velocities.append(speed)
        
        return {
            'id': trajectory_id, # 補回 id 解決 KeyError
            'start_frame': trajectory[0]['frame'],
            'end_frame': trajectory[-1]['frame'],
            'duration': timestamps[-1] - timestamps[0],
            'positions': positions,
            'velocities': velocities,
            'avg_velocity': np.mean(velocities) if velocities else 0,
            'max_velocity': np.max(velocities) if velocities else 0,
            'trajectory_length': len(trajectory)
        }

    def calculate_stability_score(self, ball_positions, total_frames):
        """ 100% 原始穩定度分數邏輯 (加上 0-100 防護) """
        detected_frames = [f for f in ball_positions if any(d['class_id'] != 38 for d in f['detections'])]
        num_detected_frames = len(detected_frames)
        
        if total_frames == 0: return 0.0
        detection_ratio = num_detected_frames / total_frames
            
        avg_confidence = 0.0
        if num_detected_frames > 0:
            total_confidence = sum(max([d['confidence'] for d in f['detections'] if d['class_id'] != 38]) for f in detected_frames)
            avg_confidence = total_confidence / num_detected_frames
        
        stability_score_raw = (detection_ratio * 0.7) + (avg_confidence * 0.3)
        # 確保回傳值為 0-100 之間，並保留兩位小數
        return round(min(stability_score_raw * 100, 100.0), 2)