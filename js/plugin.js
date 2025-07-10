// 装飾ツール - メイン機能
class DecorationTool {
	constructor() {
		console.log('DecorationTool constructor called');
		this.canvas = null;
		this.ctx = null;
		this.isDrawing = false;
		this.currentTool = 'pen';
		this.currentColor = 'red';
		this.currentSize = 3;
		this.currentMosaicLevel = 20; // モザイクの荒さ (最粗:50, 粗:30, 中:20, 細:10)
		this.lastX = 0;
		this.lastY = 0;
		this.history = [];
		this.historyIndex = -1;
		this.selectedImage = null; // 選択された画像
		this.isEagleReady = false; // Eagle APIが使用可能かどうか

		// 拡大・移動用
		this.scale = 1.0;
		this.originX = 0;
		this.originY = 0;
		this.isDragging = false;
		this.dragStartX = 0;
		this.dragStartY = 0;
		
		// モザイク用
		this.isSelecting = false;
		this.selectionStart = { x: 0, y: 0 };
		this.selectionEnd = { x: 0, y: 0 };
		this.selectionOverlay = null; // 選択範囲表示用
	}

	async init() {
		console.log('装飾ツール初期化開始');
		
		// Canvas要素取得
		this.canvas = document.getElementById('drawingCanvas');
		if (!this.canvas) {
			console.error('Canvas要素が見つかりません');
			this.showMessage('Canvas要素が見つかりません', 'error');
			return;
		}
		console.log('Canvas要素取得成功');
		
		this.ctx = this.canvas.getContext('2d');
		console.log('Canvas context取得成功');
		
		// Canvasの初期設定
		this.ctx.lineCap = 'round';
		this.ctx.lineJoin = 'round';
		this.ctx.strokeStyle = this.currentColor;
		this.ctx.fillStyle = this.currentColor;
		this.ctx.lineWidth = this.currentSize;
		this.ctx.imageSmoothingEnabled = true;
		this.ctx.imageSmoothingQuality = 'high';
		
		// イベントリスナー設定
		this.setupEventListeners();
		
		// 初期履歴保存
		this.saveHistory();
		
		console.log('装飾ツール初期化完了（Eagle API待機中）');
	}

	async initWithEagle() {
		console.log('Eagle API初期化開始');
		
		// Eagle API が利用可能かチェック
		if (typeof eagle === 'undefined') {
			console.error('Eagle API が利用できません - スタンドアロンモードで動作');
			this.showMessage('Eagle API が利用できません。テスト用キャンバスを表示します。', 'error');
			this.showTestCanvas();
			return;
		}
		console.log('Eagle API 利用可能');
		console.log('Eagle オブジェクト:', eagle);
		
		this.isEagleReady = true;
		
		// 選択された画像を読み込み
		await this.loadSelectedImage();
	}

	showTestCanvas() {
		// テスト用の背景を表示
		this.ctx.fillStyle = '#f0f0f0';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		
		// テストメッセージを描画
		this.ctx.fillStyle = '#666';
		this.ctx.font = '20px Arial';
		this.ctx.textAlign = 'center';
		this.ctx.fillText('テストモード - 画像を選択してプラグインを実行してください', this.canvas.width / 2, this.canvas.height / 2);
		
		this.saveHistory();
		this.showMessage('テストモードで動作中 - Eagleで画像を選択してプラグインを実行してください', 'loading');
	}

	async loadSelectedImage() {
		if (!this.isEagleReady) {
			console.log('Eagle API がまだ準備できていません');
			this.showMessage('Eagle API の準備中...', 'loading');
			return;
		}

		try {
			console.log('選択画像の取得を開始');
			this.showMessage('選択された画像を読み込み中...', 'loading');
			
			// Eagle APIで選択された画像を取得
			const selectedItems = await eagle.item.getSelected();
			console.log('getSelected結果:', selectedItems);
			
			if (selectedItems && selectedItems.length > 0) {
				const item = selectedItems[0];
				console.log('選択された画像:', item);
				
				// 画像情報を保存
				this.selectedImage = item;
				
				// キャンバスサイズを画像に合わせて調整
				if (item.width && item.height) {
					console.log(`画像サイズ: ${item.width}×${item.height}`);
					this.canvas.width = item.width;
					this.canvas.height = item.height;
					
					// CSSサイズも調整（表示サイズ）
					const maxWidth = window.innerWidth - 100;
					const maxHeight = window.innerHeight - 200;
					
					let displayWidth = item.width;
					let displayHeight = item.height;
					
					// 画像が大きすぎる場合は縮小表示
					if (displayWidth > maxWidth || displayHeight > maxHeight) {
						const scaleX = maxWidth / displayWidth;
						const scaleY = maxHeight / displayHeight;
						const scale = Math.min(scaleX, scaleY);
						
						displayWidth = displayWidth * scale;
						displayHeight = displayHeight * scale;
						console.log(`表示サイズ調整: ${displayWidth}×${displayHeight} (scale: ${scale})`);
					}
					
					this.canvas.style.width = displayWidth + 'px';
					this.canvas.style.height = displayHeight + 'px';
				}
				
				// 画像をCanvasに描画
				await this.loadImageToCanvas(item);
			} else {
				console.log('選択された画像がありません');
				this.showMessage('画像を選択してからプラグインを実行してください', 'error');
			}
		} catch (error) {
			console.error('選択画像取得エラー:', error);
			this.showMessage(`選択された画像の取得に失敗しました: ${error.message}`, 'error');
		}
	}

	async loadImageToCanvas(item) {
		console.log('loadImageToCanvas開始:', item);
		
		// 複数の方法で画像URLを取得する
		let imageUrl = null;
		let urlMethod = 'unknown';
		
		try {
			// 方法1: fileURLを直接使用
			if (item.fileURL) {
				imageUrl = item.fileURL;
				urlMethod = 'fileURL';
				console.log('fileURL使用:', imageUrl);
			}
			// 方法2: thumbnailURLを使用
			else if (item.thumbnailURL) {
				imageUrl = item.thumbnailURL;
				urlMethod = 'thumbnailURL';
				console.log('thumbnailURL使用:', imageUrl);
			}
			// 方法3: filePathから変換（フォールバック）
			else if (item.filePath && typeof eagle.path !== 'undefined' && eagle.path.toURL) {
				try {
					imageUrl = await eagle.path.toURL(item.filePath);
					urlMethod = 'filePath->URL';
					console.log('filePath->URL変換成功:', imageUrl);
				} catch (pathError) {
					console.error('filePath->URL変換エラー:', pathError);
				}
			}
			
			if (!imageUrl) {
				console.error('画像URLを取得できません。利用可能なプロパティ:', Object.keys(item));
				this.showMessage('画像URLを取得できませんでした', 'error');
				return;
			}
			
			// 画像を読み込み
			console.log(`画像読み込み開始 (${urlMethod}):`, imageUrl);
			const img = new Image();
			
			img.onload = () => {
				console.log('画像読み込み成功');
				try {
					// 初期表示位置を中央に
					this.originX = (this.canvas.width - this.canvas.width * this.scale) / 2;
					this.originY = (this.canvas.height - this.canvas.height * this.scale) / 2;

					// 画像を描画
					this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
					this.saveHistory(); // 画像読み込み後に履歴保存
					this.showMessage(`画像読み込み完了: ${item.name} (${item.width}×${item.height}) [${urlMethod}]`, 'success');
				} catch (drawError) {
					console.error('画像描画エラー:', drawError);
					this.showMessage('画像の描画に失敗しました', 'error');
				}
			};
			
			img.onerror = (error) => {
				console.error('画像読み込みエラー:', error, 'URL:', imageUrl);
				this.showMessage(`画像の読み込みに失敗しました (${urlMethod})`, 'error');
			};
			
			// CORS対応
			img.crossOrigin = 'anonymous';
			img.src = imageUrl;
			
		} catch (error) {
			console.error('loadImageToCanvas全体エラー:', error);
			this.showMessage(`画像読み込み処理でエラーが発生しました: ${error.message}`, 'error');
		}
	}

	showMessage(message, type = 'info') {
		console.log(`Message: ${message} (${type})`);
		const messageDiv = document.getElementById('message');
		if (messageDiv) {
			// 既存のクラスを削除
			messageDiv.className = '';
			
			// タイプに応じてクラスを追加
			switch (type) {
				case 'error':
					messageDiv.className = 'error';
					break;
				case 'success':
					messageDiv.className = 'success';
					break;
				case 'loading':
					messageDiv.className = 'loading';
					break;
				default:
					messageDiv.className = '';
			}
			
			messageDiv.innerHTML = message;
		}
	}

	setupEventListeners() {
		console.log('イベントリスナー設定開始');
		
		// Canvas描画イベント（マウス）
		this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
		this.canvas.addEventListener('mousemove', (e) => this.draw(e));
		this.canvas.addEventListener('mouseup', () => this.stopDrawing());
		this.canvas.addEventListener('mouseout', () => this.stopDrawing());
		this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

		// Canvas描画イベント（タッチ）
		this.canvas.addEventListener('touchstart', (e) => {
			e.preventDefault();
			const touch = e.touches[0];
			const mouseEvent = new MouseEvent('mousedown', {
				clientX: touch.clientX,
				clientY: touch.clientY
			});
			this.startDrawing(mouseEvent);
		});

		this.canvas.addEventListener('touchmove', (e) => {
			e.preventDefault();
			const touch = e.touches[0];
			const mouseEvent = new MouseEvent('mousemove', {
				clientX: touch.clientX,
				clientY: touch.clientY
			});
			this.draw(mouseEvent);
		});

		this.canvas.addEventListener('touchend', (e) => {
			e.preventDefault();
			this.stopDrawing();
		});

		// ツールボタン
		document.getElementById('penTool').addEventListener('click', () => this.setTool('pen'));
		document.getElementById('mosaicTool').addEventListener('click', () => this.setTool('mosaic'));
		document.getElementById('handTool').addEventListener('click', () => this.setTool('hand'));

		// 色選択ボタン
		document.querySelectorAll('.color-button').forEach(button => {
			button.addEventListener('click', (e) => this.setColor(e.target.dataset.color));
		});

		// サイズ選択ボタン
		document.querySelectorAll('.size-button').forEach(button => {
			button.addEventListener('click', (e) => this.setSize(parseInt(e.target.dataset.size)));
		});

		// モザイクの荒さ選択ボタン
		document.querySelectorAll('.mosaic-level-button').forEach(button => {
			button.addEventListener('click', (e) => this.setMosaicLevel(parseInt(e.target.dataset.level)));
		});

		// 下部ツールバー
		document.getElementById('clearBtn').addEventListener('click', async () => await this.clearCanvas());
		document.getElementById('undoBtn').addEventListener('click', () => this.undo());
		document.getElementById('redoBtn').addEventListener('click', () => this.redo());
		document.getElementById('saveBtn').addEventListener('click', async () => await this.saveImage());
		
		// キーボードショートカット
		document.addEventListener('keydown', (e) => this.handleKeyDown(e));
		
		console.log('イベントリスナー設定完了');
	}

	handleKeyDown(e) {
		// Ctrl+Z または Cmd+Z (macOS)
		if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			this.undo();
			return;
		}
		
		// Ctrl+Y または Cmd+Shift+Z (macOS) または Ctrl+Shift+Z
		if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
			((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
			e.preventDefault();
			this.redo();
			return;
		}
	}

	setTool(tool) {
		this.currentTool = tool;
		
		// ボタンのアクティブ状態更新
		document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
		document.getElementById(tool + 'Tool').classList.add('active');

		// UIグループの表示/非表示を切り替え
		const isPen = tool === 'pen';
		const isMosaic = tool === 'mosaic';
		const isHand = tool === 'hand';

		document.getElementById('colorGroup').style.display = isPen ? 'flex' : 'none';
		document.getElementById('sizeGroup').style.display = isPen ? 'flex' : 'none';
		document.getElementById('sizeSeparator').style.display = isPen ? 'block' : 'none';
		document.getElementById('mosaicLevelGroup').style.display = isMosaic ? 'flex' : 'none';
		document.getElementById('mosaicSeparator').style.display = isMosaic ? 'block' : 'none';
		
		// カーソル変更
		if (isHand) {
			this.canvas.style.cursor = 'grab';
		} else if (isMosaic) {
			this.canvas.style.cursor = 'crosshair';
		} else {
			this.canvas.style.cursor = 'crosshair';
		}
		
		// ツール切り替え時のメッセージ表示
		let message = '';
		switch (tool) {
			case 'pen':
				message = 'ペンツールを選択しました。ドラッグして描画できます。';
				break;
			case 'mosaic':
				message = 'モザイクツールを選択しました。ドラッグして範囲を選択してください。';
				break;
			case 'hand':
				message = 'ハンドツールを選択しました。ドラッグして画像を移動できます。';
				break;
		}
		this.showMessage(message, 'info');
		
		console.log('ツール変更:', tool);
	}

	setColor(color) {
		this.currentColor = color;
		this.ctx.strokeStyle = color;
		this.ctx.fillStyle = color;
		
		// ボタンのアクティブ状態更新
		document.querySelectorAll('.color-button').forEach(btn => btn.classList.remove('active'));
		document.querySelector(`[data-color="${color}"]`).classList.add('active');
		
		console.log('色変更:', color);
	}

	setSize(size) {
		this.currentSize = size;
		this.ctx.lineWidth = size;
		
		// ボタンのアクティブ状態更新
		document.querySelectorAll('.size-button').forEach(btn => btn.classList.remove('active'));
		document.querySelector(`[data-size="${size}"]`).classList.add('active');
		
		console.log('サイズ変更:', size);
	}

	setMosaicLevel(level) {
		this.currentMosaicLevel = level;

		// ボタンのアクティブ状態更新
		document.querySelectorAll('.mosaic-level-button').forEach(btn => btn.classList.remove('active'));
		document.querySelector(`[data-level="${level}"]`).classList.add('active');

		console.log('モザイクの荒さ変更:', level);
	}

	getMousePos(e) {
		const rect = this.canvas.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left - this.originX) / this.scale,
			y: (e.clientY - rect.top - this.originY) / this.scale
		};
	}

	// スケール/変換を考慮しない実際のキャンバス座標を取得
	getRealCanvasPos(e) {
		const rect = this.canvas.getBoundingClientRect();
		const scaleX = this.canvas.width / rect.width;
		const scaleY = this.canvas.height / rect.height;
		return {
			x: (e.clientX - rect.left) * scaleX,
			y: (e.clientY - rect.top) * scaleY
		};
	}

	startDrawing(e) {
		if (this.currentTool === 'hand') {
			this.isDragging = true;
			this.dragStartX = e.clientX;
			this.dragStartY = e.clientY;
			this.canvas.style.cursor = 'grabbing';
			return;
		}

		if (this.currentTool === 'mosaic') {
			// モザイク選択時は実際のキャンバス座標を使用
			const pos = this.getRealCanvasPos(e);
			console.log('モザイク選択開始:', pos);
			this.isSelecting = true;
			this.selectionStart = pos;
			this.selectionEnd = pos;
			// 選択開始時の表示を更新
			this.drawSelection();
			return;
		}
		
		// ペンツールも実際のキャンバス座標を使用
		const pos = this.getRealCanvasPos(e);
		this.isDrawing = true;
		this.lastX = pos.x;
		this.lastY = pos.y;
		
		// 描画設定
		this.ctx.globalCompositeOperation = 'source-over';
		this.ctx.strokeStyle = this.currentColor;
		this.ctx.fillStyle = this.currentColor;
		this.ctx.lineWidth = this.currentSize;
		
		// 開始点に円を描画
		this.ctx.beginPath();
		this.ctx.arc(pos.x, pos.y, this.currentSize / 2, 0, Math.PI * 2);
		this.ctx.fill();
	}

	draw(e) {
		if (this.isDragging) {
			const dx = e.clientX - this.dragStartX;
			const dy = e.clientY - this.dragStartY;
			this.originX += dx;
			this.originY += dy;
			this.dragStartX = e.clientX;
			this.dragStartY = e.clientY;
			this.drawImageWithTransform();
			return;
		}

		if (!this.isDrawing && !this.isSelecting) return;
		
		if (this.isSelecting) {
			// モザイク選択時は実際のキャンバス座標を使用
			const pos = this.getRealCanvasPos(e);
			this.selectionEnd = pos;
			console.log('モザイク選択中:', this.selectionStart, '->', this.selectionEnd);
			this.drawSelection();
			return;
		}
		
		// ペンツールも実際のキャンバス座標を使用
		const pos = this.getRealCanvasPos(e);
		
		// 移動距離を計算
		const distance = Math.sqrt(Math.pow(pos.x - this.lastX, 2) + Math.pow(pos.y - this.lastY, 2));
		
		// 距離が短い場合は単純な線を描画
		if (distance < 2) {
			// 点を描画
			this.ctx.beginPath();
			this.ctx.arc(pos.x, pos.y, this.currentSize / 2, 0, Math.PI * 2);
			this.ctx.fill();
		} else {
			// 補間点を使用して滑らかな線を描画
			const steps = Math.max(Math.floor(distance / 2), 1);
			
			for (let i = 0; i < steps; i++) {
				const t = i / steps;
				const x = this.lastX + (pos.x - this.lastX) * t;
				const y = this.lastY + (pos.y - this.lastY) * t;
				
				this.ctx.beginPath();
				this.ctx.arc(x, y, this.currentSize / 2, 0, Math.PI * 2);
				this.ctx.fill();
			}
			
			// 最終点も描画
			this.ctx.beginPath();
			this.ctx.arc(pos.x, pos.y, this.currentSize / 2, 0, Math.PI * 2);
			this.ctx.fill();
		}
		
		this.lastX = pos.x;
		this.lastY = pos.y;
	}

	stopDrawing() {
		if (this.isDragging) {
			this.isDragging = false;
			this.canvas.style.cursor = 'grab';
		}

		if (this.isDrawing) {
			this.isDrawing = false;
			this.saveHistory();
		}
		
		if (this.isSelecting) {
			console.log('モザイク選択終了:', this.selectionStart, '->', this.selectionEnd);
			this.isSelecting = false;
			this.applyMosaic();
		}
	}

	drawSelection() {
		// 元の画像を再描画
		this.redrawCanvas();
		
		// 選択範囲の計算
		const startX = Math.min(this.selectionStart.x, this.selectionEnd.x);
		const startY = Math.min(this.selectionStart.y, this.selectionEnd.y);
		const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
		const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);
		
		console.log(`選択範囲描画: (${startX}, ${startY}) - ${width}×${height}`);
		
		// 選択範囲を描画（実際のキャンバス座標）
		this.ctx.save();
		this.ctx.setTransform(1, 0, 0, 1, 0, 0); // 変換をリセット
		this.ctx.strokeStyle = '#ff0000';
		this.ctx.lineWidth = 2;
		this.ctx.setLineDash([5, 5]);
		
		// 有効な範囲のみ描画
		if (width > 1 && height > 1) {
			this.ctx.strokeRect(startX, startY, width, height);
		}
		
		this.ctx.restore();
	}

	redrawCanvas() {
		// 現在の履歴から画像を再描画
		if (this.history.length > 0) {
			const currentImageData = this.history[this.historyIndex];
			const tempCanvas = document.createElement('canvas');
			tempCanvas.width = this.canvas.width;
			tempCanvas.height = this.canvas.height;
			const tempCtx = tempCanvas.getContext('2d');
			tempCtx.putImageData(currentImageData, 0, 0);

			this.ctx.save();
			this.ctx.setTransform(1, 0, 0, 1, 0, 0);
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.ctx.restore();

			this.ctx.drawImage(tempCanvas, 0, 0);
		}
	}

		applyMosaic() {
		console.log('モザイク処理開始');
		console.log('選択開始点:', this.selectionStart);
		console.log('選択終了点:', this.selectionEnd);

		const x1 = Math.round(this.selectionStart.x);
		const y1 = Math.round(this.selectionStart.y);
		const x2 = Math.round(this.selectionEnd.x);
		const y2 = Math.round(this.selectionEnd.y);

		const startX = Math.max(0, Math.min(x1, x2));
		const startY = Math.max(0, Math.min(y1, y2));
		const endX = Math.min(this.canvas.width, Math.max(x1, x2));
		const endY = Math.min(this.canvas.height, Math.max(y1, y2));
		const width = endX - startX;
		const height = endY - startY;
		
		console.log(`補正後選択範囲: (${startX}, ${startY}) - ${width}×${height}`);
		console.log(`キャンバスサイズ: ${this.canvas.width}×${this.canvas.height}`);
		
		if (width < 5 || height < 5) {
			console.log('選択範囲が小さすぎます');
			this.redrawCanvas(); // 選択範囲をクリア
			this.showMessage('選択範囲が小さすぎます（最低5×5ピクセル必要）', 'error');
			return;
		}
		
		// 選択範囲をクリア
		this.redrawCanvas();
		
		// モザイク強度
		const mosaicSize = this.currentMosaicLevel;
		console.log(`モザイクサイズ: ${mosaicSize}`);
		
		try {
			const imageData = this.ctx.getImageData(startX, startY, width, height);
			const data = imageData.data;
			
			// モザイク処理
			for (let y = 0; y < height; y += mosaicSize) {
				for (let x = 0; x < width; x += mosaicSize) {
					// ブロック内の平均色を計算
					let r = 0, g = 0, b = 0, a = 0, count = 0;
					
					const blockWidth = Math.min(mosaicSize, width - x);
					const blockHeight = Math.min(mosaicSize, height - y);
					
					for (let dy = 0; dy < blockHeight; dy++) {
						for (let dx = 0; dx < blockWidth; dx++) {
							const i = ((y + dy) * width + (x + dx)) * 4;
							if (i < data.length) {
								r += data[i];
								g += data[i + 1];
								b += data[i + 2];
								a += data[i + 3];
								count++;
							}
						}
					}
					
					if (count > 0) {
						r = Math.floor(r / count);
						g = Math.floor(g / count);
						b = Math.floor(b / count);
						a = Math.floor(a / count);
						
						// ブロック全体を平均色で塗りつぶし
						for (let dy = 0; dy < blockHeight; dy++) {
							for (let dx = 0; dx < blockWidth; dx++) {
								const i = ((y + dy) * width + (x + dx)) * 4;
								if (i < data.length) {
									data[i] = r;
									data[i + 1] = g;
									data[i + 2] = b;
									data[i + 3] = a;
								}
							}
						}
					}
				}
			}
			
			this.ctx.putImageData(imageData, startX, startY);
			this.saveHistory();
			console.log('モザイク処理完了');
			this.showMessage(`モザイク処理完了: ${width}×${height}px`, 'success');
			
		} catch (error) {
			console.error('モザイク処理エラー:', error);
			this.showMessage('モザイク処理に失敗しました', 'error');
		}
	}

	handleWheel(e) {
		e.preventDefault();
		const scaleAmount = 0.1;
		const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
		const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;

		if (e.deltaY < 0) {
			// Zoom in
			this.scale += scaleAmount;
		} else {
			// Zoom out
			this.scale -= scaleAmount;
		}
		this.scale = Math.max(0.1, Math.min(this.scale, 10)); // スケール範囲制限

		// マウス位置を中心にズーム
		this.originX = mouseX - (mouseX - this.originX) * (this.scale / (this.scale - (e.deltaY < 0 ? scaleAmount : -scaleAmount)));
		this.originY = mouseY - (mouseY - this.originY) * (this.scale / (this.scale - (e.deltaY < 0 ? scaleAmount : -scaleAmount)));

		this.drawImageWithTransform();
	}

	drawImageWithTransform() {
		this.ctx.save();
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.translate(this.originX, this.originY);
		this.ctx.scale(this.scale, this.scale);
		this.redrawCanvas();
		this.ctx.restore();
	}

	async clearCanvas() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		// 元画像を再描画
		if (this.selectedImage) {
			console.log('クリア後の元画像再描画');
			await this.loadImageToCanvas(this.selectedImage);
		} else {
			this.saveHistory();
		}
	}

	saveHistory() {
		// 現在位置以降の履歴を削除（新しい操作をした場合）
		this.history = this.history.slice(0, this.historyIndex + 1);
		
		// 履歴のサイズ制限
		if (this.history.length > 50) {
			this.history.shift();
			this.historyIndex--;
		}
		
		// 現在の状態を保存
		const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
		this.history.push(imageData);
		this.historyIndex = this.history.length - 1;
		
		// ボタンの状態を更新
		this.updateHistoryButtons();
		
		console.log(`履歴保存: ${this.historyIndex + 1}/${this.history.length}`);
	}

	updateHistoryButtons() {
		const undoBtn = document.getElementById('undoBtn');
		const redoBtn = document.getElementById('redoBtn');
		
		if (undoBtn) {
			undoBtn.disabled = this.historyIndex <= 0;
			undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
		}
		
		if (redoBtn) {
			redoBtn.disabled = this.historyIndex >= this.history.length - 1;
			redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
		}
	}

	undo() {
		if (this.historyIndex > 0) {
			this.historyIndex--;
			const imageData = this.history[this.historyIndex];
			this.ctx.putImageData(imageData, 0, 0);
			this.updateHistoryButtons();
			console.log(`Undo: ${this.historyIndex + 1}/${this.history.length}`);
		}
	}

	redo() {
		if (this.historyIndex < this.history.length - 1) {
			this.historyIndex++;
			const imageData = this.history[this.historyIndex];
			this.ctx.putImageData(imageData, 0, 0);
			this.updateHistoryButtons();
			console.log(`Redo: ${this.historyIndex + 1}/${this.history.length}`);
		}
	}

	async saveImage() {
		if (!this.isEagleReady) {
			console.log('Eagle API がまだ準備できていません');
			this.showMessage('Eagle API の準備中...', 'error');
			return;
		}

		try {
			const dataURL = this.canvas.toDataURL('image/png');
			
			if (this.selectedImage) {
				// Eagleライブラリに画像を追加
				const itemId = await eagle.item.addFromBase64(dataURL, {
					name: this.selectedImage.name + '_装飾済み',
					website: 'Eagle装飾ツール',
					tags: ['装飾済み', '編集済み'],
					folders: this.selectedImage.folders || [],
					annotation: '装飾ツールで編集された画像'
				});
				
				console.log('Eagleに保存完了:', itemId);
				this.showMessage('装飾済み画像をEagleライブラリに保存しました！', 'success');
			} else {
				// 新しいウィンドウで画像を表示（フォールバック）
				const newWindow = window.open();
				newWindow.document.write(`
					<html>
						<head><title>装飾済み画像</title></head>
						<body style="margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0;">
							<img src="${dataURL}" style="max-width: 100%; max-height: 100vh; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
						</body>
					</html>
				`);
			}
		} catch (error) {
			console.error('画像保存エラー:', error);
			this.showMessage('画像の保存に失敗しました', 'error');
		}
	}
}

// Eagle Plugin API
let decorationTool = null;

console.log('Plugin script loaded');

eagle.onPluginCreate((plugin) => {
	console.log('eagle.onPluginCreate called');
	console.log('Plugin info:', plugin);
	
	// プラグイン情報表示
	const messageDiv = document.querySelector('#message');
	if (messageDiv) {
		messageDiv.className = '';
		messageDiv.innerHTML = `
			<div>プラグイン情報:</div>
			<ul style="margin: 10px 0; padding-left: 20px;">
				<li>名前: ${plugin.manifest.name}</li>
				<li>バージョン: ${plugin.manifest.version}</li>
				<li>ID: ${plugin.manifest.id}</li>
			</ul>
			<div style="margin-top: 10px; color: #007AFF;">Eagle API準備完了！</div>
		`;
	}

	// 装飾ツール初期化（Eagle API なし）
	decorationTool = new DecorationTool();
	decorationTool.init();
});

eagle.onPluginRun(async () => {
	console.log('eagle.onPluginRun called');
	
	// Eagle API を使用した初期化
	if (decorationTool) {
		await decorationTool.initWithEagle();
	}
});

eagle.onPluginShow(() => {
	console.log('eagle.onPluginShow called');
});

eagle.onPluginHide(() => {
	console.log('eagle.onPluginHide called');
});

eagle.onPluginBeforeExit((event) => {
	console.log('eagle.onPluginBeforeExit called');
});

// フォールバック: Eagleプラグインとして動作しない場合の処理
document.addEventListener('DOMContentLoaded', () => {
	console.log('DOMContentLoaded event fired');
	
	// 少し待ってからEagle APIが読み込まれているかチェック
	setTimeout(() => {
		if (typeof eagle === 'undefined' && !decorationTool) {
			console.log('Eagle API未検出 - スタンドアロンモードで初期化');
			decorationTool = new DecorationTool();
			decorationTool.init();
			decorationTool.showTestCanvas();
		}
	}, 1000);
});