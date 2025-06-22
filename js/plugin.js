// 装飾ツール - メイン機能
class DecorationTool {
	constructor() {
		console.log('DecorationTool constructor called');
		this.canvas = null;
		this.ctx = null;
		this.isDrawing = false;
		this.currentTool = 'pen';
		this.currentColor = 'red';
		this.currentSize = 1;
		this.lastX = 0;
		this.lastY = 0;
		this.history = [];
		this.historyIndex = -1;
		this.selectedImage = null; // 選択された画像
		this.isEagleReady = false; // Eagle APIが使用可能かどうか
		
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
		this.ctx.lineWidth = this.currentSize;
		
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
			console.error('Eagle API が利用できません');
			this.showMessage('Eagle API が利用できません', 'error');
			return;
		}
		console.log('Eagle API 利用可能');
		
		this.isEagleReady = true;
		
		// 選択された画像を読み込み
		await this.loadSelectedImage();
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
				if (item.thumbnailURL || item.fileURL) {
					console.log('画像URL:', item.fileURL || item.thumbnailURL);
					const img = new Image();
					img.onload = () => {
						console.log('画像読み込み成功');
						this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
						this.saveHistory(); // 画像読み込み後に履歴保存
						this.showMessage(`画像読み込み完了: ${item.name} (${item.width}×${item.height})`, 'success');
					};
					img.onerror = (error) => {
						console.error('画像読み込みエラー:', error);
						this.showMessage('画像の読み込みに失敗しました', 'error');
					};
					// サムネイルではなく元画像を使用
					img.src = item.fileURL || item.thumbnailURL;
				} else {
					console.log('画像URLが見つかりません');
					this.showMessage('画像URLが見つかりません', 'error');
				}
			} else {
				console.log('選択された画像がありません');
				this.showMessage('画像を選択してからプラグインを実行してください', 'error');
			}
		} catch (error) {
			console.error('選択画像取得エラー:', error);
			this.showMessage(`選択された画像の取得に失敗しました: ${error.message}`, 'error');
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
		
		// Canvas描画イベント
		this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
		this.canvas.addEventListener('mousemove', (e) => this.draw(e));
		this.canvas.addEventListener('mouseup', () => this.stopDrawing());
		this.canvas.addEventListener('mouseout', () => this.stopDrawing());

		// ツールボタン
		document.getElementById('penTool').addEventListener('click', () => this.setTool('pen'));
		document.getElementById('mosaicTool').addEventListener('click', () => this.setTool('mosaic'));
		document.getElementById('eraserTool').addEventListener('click', () => this.setTool('eraser'));

		// 色選択ボタン
		document.querySelectorAll('.color-button').forEach(button => {
			button.addEventListener('click', (e) => this.setColor(e.target.dataset.color));
		});

		// サイズ選択ボタン
		document.querySelectorAll('.size-button').forEach(button => {
			button.addEventListener('click', (e) => this.setSize(parseInt(e.target.dataset.size)));
		});

		// 下部ツールバー
		document.getElementById('clearBtn').addEventListener('click', () => this.clearCanvas());
		document.getElementById('undoBtn').addEventListener('click', () => this.undo());
		document.getElementById('redoBtn').addEventListener('click', () => this.redo());
		document.getElementById('saveBtn').addEventListener('click', () => this.saveImage());
		
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
		
		// カーソル変更
		if (tool === 'mosaic') {
			this.canvas.style.cursor = 'crosshair';
		} else if (tool === 'eraser') {
			this.canvas.style.cursor = 'grab';
		} else {
			this.canvas.style.cursor = 'crosshair';
		}
		
		console.log('ツール変更:', tool);
	}

	setColor(color) {
		this.currentColor = color;
		this.ctx.strokeStyle = color;
		
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

	getMousePos(e) {
		const rect = this.canvas.getBoundingClientRect();
		const scaleX = this.canvas.width / rect.width;
		const scaleY = this.canvas.height / rect.height;
		
		return {
			x: (e.clientX - rect.left) * scaleX,
			y: (e.clientY - rect.top) * scaleY
		};
	}

	startDrawing(e) {
		const pos = this.getMousePos(e);
		
		if (this.currentTool === 'mosaic') {
			this.isSelecting = true;
			this.selectionStart = pos;
			this.selectionEnd = pos;
			return;
		}
		
		this.isDrawing = true;
		this.lastX = pos.x;
		this.lastY = pos.y;
		
		// 描画設定
		if (this.currentTool === 'eraser') {
			this.ctx.globalCompositeOperation = 'destination-out';
		} else {
			this.ctx.globalCompositeOperation = 'source-over';
			this.ctx.strokeStyle = this.currentColor;
		}
		
		this.ctx.lineWidth = this.currentSize;
	}

	draw(e) {
		if (!this.isDrawing && !this.isSelecting) return;
		
		const pos = this.getMousePos(e);
		
		if (this.isSelecting) {
			// モザイク選択範囲の描画
			this.selectionEnd = pos;
			this.drawSelection();
			return;
		}
		
		this.ctx.beginPath();
		this.ctx.moveTo(this.lastX, this.lastY);
		this.ctx.lineTo(pos.x, pos.y);
		this.ctx.stroke();
		
		this.lastX = pos.x;
		this.lastY = pos.y;
	}

	stopDrawing() {
		if (this.isDrawing) {
			this.isDrawing = false;
			this.saveHistory();
		}
		
		if (this.isSelecting) {
			this.isSelecting = false;
			this.applyMosaic();
		}
	}

	drawSelection() {
		// 一時的なCanvasを作成して選択範囲を表示
		this.redrawCanvas();
		
		// 選択範囲を描画
		this.ctx.save();
		this.ctx.strokeStyle = '#ff0000';
		this.ctx.lineWidth = 2;
		this.ctx.setLineDash([5, 5]);
		this.ctx.strokeRect(
			this.selectionStart.x,
			this.selectionStart.y,
			this.selectionEnd.x - this.selectionStart.x,
			this.selectionEnd.y - this.selectionStart.y
		);
		this.ctx.restore();
	}

	redrawCanvas() {
		// 現在の履歴から画像を再描画
		if (this.history.length > 0) {
			const currentImageData = this.history[this.historyIndex];
			this.ctx.putImageData(currentImageData, 0, 0);
		}
	}

	applyMosaic() {
		console.log('モザイク処理開始');
		
		const startX = Math.min(this.selectionStart.x, this.selectionEnd.x);
		const startY = Math.min(this.selectionStart.y, this.selectionEnd.y);
		const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
		const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);
		
		console.log(`選択範囲: (${startX}, ${startY}) - ${width}×${height}`);
		
		if (width < 5 || height < 5) {
			console.log('選択範囲が小さすぎます');
			this.redrawCanvas(); // 選択範囲をクリア
			return;
		}
		
		// 選択範囲をクリア
		this.redrawCanvas();
		
		// モザイク強度
		const mosaicSize = Math.max(5, Math.min(width, height) / 20);
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
			
		} catch (error) {
			console.error('モザイク処理エラー:', error);
			this.showMessage('モザイク処理に失敗しました', 'error');
		}
	}

	clearCanvas() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		// 元画像を再描画
		if (this.selectedImage && (this.selectedImage.thumbnailURL || this.selectedImage.fileURL)) {
			const img = new Image();
			img.onload = () => {
				this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
				this.saveHistory();
			};
			img.src = this.selectedImage.fileURL || this.selectedImage.thumbnailURL;
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