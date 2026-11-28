"""Vídeo redondo flutuante estilo liquid glass, arrastável.
Uso: python video_bolha.py caminho/video.mp4
Requisitos: pip install PySide6
Duplo clique: pausa/retoma. Clique direito / Esc: fechar.
"""
import sys
from PySide6.QtCore import Qt, QUrl, QPointF, QRectF
from PySide6.QtGui import (QPainter, QPainterPath, QRadialGradient, QLinearGradient,
                           QColor, QPen, QImage, QGuiApplication)
from PySide6.QtWidgets import QApplication, QWidget, QFileDialog
from PySide6.QtMultimedia import QMediaPlayer, QAudioOutput, QVideoSink


def diametro_cartao_px():
    # largura de cartão de crédito: 85.6 mm
    dpi = QGuiApplication.primaryScreen().logicalDotsPerInch() or 96
    return int(85.6 / 25.4 * dpi)


class VideoBolha(QWidget):
    def __init__(self, ficheiro):
        super().__init__()
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.margem = 14
        d = diametro_cartao_px()
        self.d = d
        self.resize(d + 2 * self.margem, d + 2 * self.margem)
        self.frame = QImage()
        self._arrasto = None

        self.player = QMediaPlayer(self)
        self.audio = QAudioOutput(self)
        self.player.setAudioOutput(self.audio)
        self.sink = QVideoSink(self)
        self.sink.videoFrameChanged.connect(self._novo_frame)
        self.player.setVideoSink(self.sink)
        self.player.setLoops(QMediaPlayer.Infinite)
        self.player.setSource(QUrl.fromLocalFile(ficheiro))
        self.player.play()

    def _novo_frame(self, f):
        self.frame = f.toImage()
        self.update()

    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        p.setRenderHint(QPainter.SmoothPixmapTransform)
        m, d = self.margem, self.d
        r = QRectF(m, m, d, d)
        c = r.center()

        # sombra suave
        sombra = QRadialGradient(c + QPointF(0, 5), d / 2 + m)
        sombra.setColorAt(0.85, QColor(0, 0, 0, 90))
        sombra.setColorAt(1.0, QColor(0, 0, 0, 0))
        p.setPen(Qt.NoPen)
        p.setBrush(sombra)
        p.drawEllipse(c + QPointF(0, 5), d / 2 + m - 2, d / 2 + m - 2)

        circulo = QPainterPath()
        circulo.addEllipse(r)
        p.save()
        p.setClipPath(circulo)
        if not self.frame.isNull():
            img = self.frame.scaled(d, d, Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation)
            p.drawImage(QPointF(c.x() - img.width() / 2, c.y() - img.height() / 2), img)
        else:
            p.fillRect(r, QColor(30, 30, 40))

        # refração nas bordas (vinheta de vidro)
        borda = QRadialGradient(c, d / 2)
        borda.setColorAt(0.70, QColor(255, 255, 255, 0))
        borda.setColorAt(0.93, QColor(255, 255, 255, 40))
        borda.setColorAt(1.0, QColor(255, 255, 255, 110))
        p.fillRect(r, borda)

        # brilho especular superior
        brilho = QLinearGradient(r.topLeft(), QPointF(r.left(), c.y()))
        brilho.setColorAt(0, QColor(255, 255, 255, 120))
        brilho.setColorAt(1, QColor(255, 255, 255, 0))
        p.setBrush(brilho)
        p.drawEllipse(QRectF(r.left() + d * 0.15, r.top() + d * 0.04, d * 0.7, d * 0.42))

        # reflexo inferior
        baixo = QRadialGradient(QPointF(c.x(), r.bottom()), d * 0.45)
        baixo.setColorAt(0, QColor(255, 255, 255, 60))
        baixo.setColorAt(1, QColor(255, 255, 255, 0))
        p.fillRect(r, baixo)
        p.restore()

        # aro de vidro
        aro = QLinearGradient(r.topLeft(), r.bottomRight())
        aro.setColorAt(0, QColor(255, 255, 255, 230))
        aro.setColorAt(0.5, QColor(255, 255, 255, 50))
        aro.setColorAt(1, QColor(255, 255, 255, 180))
        p.setBrush(Qt.NoBrush)
        p.setPen(QPen(aro, 2.5))
        p.drawEllipse(r.adjusted(1, 1, -1, -1))
        p.setPen(QPen(QColor(0, 0, 0, 60), 1))
        p.drawEllipse(r)

    def _dentro(self, pos):
        c = QPointF(self.width() / 2, self.height() / 2)
        v = QPointF(pos) - c
        return (v.x() ** 2 + v.y() ** 2) ** 0.5 <= self.d / 2

    def mousePressEvent(self, e):
        if e.button() == Qt.RightButton:
            self.close()
        elif e.button() == Qt.LeftButton and self._dentro(e.position()):
            self._arrasto = e.globalPosition().toPoint() - self.frameGeometry().topLeft()

    def mouseMoveEvent(self, e):
        if self._arrasto is not None:
            self.move(e.globalPosition().toPoint() - self._arrasto)

    def mouseReleaseEvent(self, _):
        self._arrasto = None

    def mouseDoubleClickEvent(self, _):
        if self.player.playbackState() == QMediaPlayer.PlayingState:
            self.player.pause()
        else:
            self.player.play()

    def keyPressEvent(self, e):
        if e.key() == Qt.Key_Escape:
            self.close()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    ficheiro = sys.argv[1] if len(sys.argv) > 1 else QFileDialog.getOpenFileName(
        None, "Escolher vídeo", "", "Vídeos (*.mp4 *.mov *.mkv *.avi *.webm)")[0]
    if not ficheiro:
        sys.exit()
    w = VideoBolha(ficheiro)
    w.show()
    sys.exit(app.exec())
