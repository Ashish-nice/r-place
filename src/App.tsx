import { useState, useRef, useEffect } from 'react'
import './App.css'

const GRID_SIZE = 360

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState('#000000')
  const [zoom, setZoom] = useState(1.25)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [pixels, setPixels] = useState<Record<string, string>>({})
  const [selectedPixel, setSelectedPixel] = useState<string | null>(null)
  const [hoveredPixel, setHoveredPixel] = useState<string | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStartX, setPanStartX] = useState(0)
  const [panStartY, setPanStartY] = useState(0)
  const [panStartPanX, setPanStartPanX] = useState(0)
  const [panStartPanY, setPanStartPanY] = useState(0)

  const getPixelCoords = (clientX: number, clientY: number): [number, number] | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    
    // Get coordinates relative to canvas element
    const x = clientX - rect.left
    const y = clientY - rect.top

    // Account for pan offset
    const gridX = (x / rect.width) * GRID_SIZE + panX
    const gridY = (y / rect.height) * GRID_SIZE + panY

    const pixelX = Math.floor(gridX)
    const pixelY = Math.floor(gridY)

    if (pixelX >= 0 && pixelX < GRID_SIZE && pixelY >= 0 && pixelY < GRID_SIZE) {
      return [pixelX, pixelY]
    }
    return null
  }

  const redrawCanvas = (
    pixelMap: Record<string, string>,
    currentZoom: number,
    currentPanX: number,
    currentPanY: number,
    selected: string | null,
    hovered: string | null
  ) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const displaySize = GRID_SIZE * currentZoom
    canvas.width = displaySize * dpr
    canvas.height = displaySize * dpr
    ctx.scale(dpr, dpr)

    // Translate canvas for panning
    ctx.translate(-currentPanX * currentZoom, -currentPanY * currentZoom)

    // Fill with white
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, displaySize, displaySize)

    // Draw grid lines - cover the entire display area
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 0.5
    
    // Draw vertical lines
    for (let i = 0; i <= GRID_SIZE; i++) {
      const x = i * currentZoom
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, displaySize)
      ctx.stroke()
    }

    // Draw horizontal lines
    for (let j = 0; j <= GRID_SIZE; j++) {
      const y = j * currentZoom
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(displaySize, y)
      ctx.stroke()
    }

    // Draw colored pixels
    Object.entries(pixelMap).forEach(([key, pixelColor]) => {
      const [x, y] = key.split(',').map(Number)
      ctx.fillStyle = pixelColor
      ctx.fillRect(x * currentZoom, y * currentZoom, currentZoom, currentZoom)
    })

    // Draw hovered pixel highlight (light blue)
    if (hovered) {
      const [x, y] = hovered.split(',').map(Number)
      ctx.strokeStyle = '#4a90e2'
      ctx.lineWidth = 1
      ctx.strokeRect(x * currentZoom, y * currentZoom, currentZoom, currentZoom)
    }

    // Draw selected pixel border (darker but thinner)
    if (selected) {
      const [x, y] = selected.split(',').map(Number)
      ctx.strokeStyle = '#333333'
      ctx.lineWidth = 1
      ctx.strokeRect(x * currentZoom, y * currentZoom, currentZoom, currentZoom)
    }
  }

  useEffect(() => {
    redrawCanvas(pixels, zoom, panX, panY, selectedPixel, hoveredPixel)
  }, [pixels, zoom, panX, panY, selectedPixel, hoveredPixel])

  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      // Prevent page scroll when scrolling over the page
      e.preventDefault()
    }

    document.addEventListener('wheel', handleGlobalWheel, { passive: false })
    return () => {
      document.removeEventListener('wheel', handleGlobalWheel)
    }
  }, [])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) return // Don't select if panning
    const coords = getPixelCoords(e.clientX, e.clientY)
    if (!coords) return
    const [pixelX, pixelY] = coords
    const key = `${pixelX},${pixelY}`
    setSelectedPixel(key)
  }

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getPixelCoords(e.clientX, e.clientY)
    if (!coords) return
    const [pixelX, pixelY] = coords
    const key = `${pixelX},${pixelY}`
    
    // Apply current color to the clicked pixel
    setPixels((prev) => ({
      ...prev,
      [key]: color,
    }))
    setSelectedPixel(key)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      // Only allow panning if zoomed in enough
      if (zoom <= 1) return

      // Handle panning
      const deltaX = e.clientX - panStartX
      const deltaY = e.clientY - panStartY
      
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      
      let newPanX = panStartPanX - (deltaX / rect.width) * GRID_SIZE
      let newPanY = panStartPanY - (deltaY / rect.height) * GRID_SIZE
      
      // Constrain panning to keep entire grid visible
      // The visible area in grid coordinates is GRID_SIZE / zoom
      const visibleGridSize = GRID_SIZE / zoom
      const maxPanX = GRID_SIZE - visibleGridSize
      const maxPanY = GRID_SIZE - visibleGridSize
      
      newPanX = Math.max(0, Math.min(newPanX, maxPanX))
      newPanY = Math.max(0, Math.min(newPanY, maxPanY))
      
      setPanX(newPanX)
      setPanY(newPanY)
    } else {
      const coords = getPixelCoords(e.clientX, e.clientY)
      if (coords) {
        const [pixelX, pixelY] = coords
        const key = `${pixelX},${pixelY}`
        setHoveredPixel(key)
      } else {
        setHoveredPixel(null)
      }
    }
  }

  const handleMouseLeave = () => {
    setHoveredPixel(null)
    setIsPanning(false)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) { // Right click
      // Only allow panning if zoomed in
      if (zoom > 1) {
        setIsPanning(true)
        setPanStartX(e.clientX)
        setPanStartY(e.clientY)
        setPanStartPanX(panX)
        setPanStartPanY(panY)
      }
      e.preventDefault()
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      setIsPanning(false)
    }
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const direction = e.deltaY > 0 ? -1 : 1
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // Get the grid coordinates under the cursor
    const gridX = (mouseX / rect.width) * GRID_SIZE + panX
    const gridY = (mouseY / rect.height) * GRID_SIZE + panY
    
    setZoom((prevZoom) => {
      const newZoom = Math.max(1, Math.min(20, prevZoom + direction))
      
      // Adjust pan so the point under cursor stays under cursor
      setPanX(() => {
        const newPanX = gridX - (mouseX / rect.width) * GRID_SIZE
        return Math.max(0, Math.min(GRID_SIZE - GRID_SIZE / newZoom, newPanX))
      })
      
      setPanY(() => {
        const newPanY = gridY - (mouseY / rect.height) * GRID_SIZE
        return Math.max(0, Math.min(GRID_SIZE - GRID_SIZE / newZoom, newPanY))
      })
      
      return newZoom
    })
  }

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value)
  }

  const clearCanvas = () => {
    setPixels({})
    setSelectedPixel(null)
  }

  return (
    <div className="app-container">
      <h1>Pixel Canvas</h1>

      <div className="controls">
        <div className="color-picker-group">
          <label htmlFor="color-picker">Pixel Color:</label>
          <input
            id="color-picker"
            type="color"
            value={color}
            onChange={handleColorChange}
            className="color-picker"
          />
        </div>

        {selectedPixel && (
          <div className="selected-info">
            Selected: {selectedPixel}
          </div>
        )}

        <span className="zoom-level">Zoom: {zoom}x</span>

        <button onClick={clearCanvas} className="btn btn-clear">
          Clear Canvas
        </button>
      </div>

      <div className="instructions">
        <small>Scroll to zoom | Right-click + drag to pan</small>
      </div>

      <canvas
        ref={canvasRef}
        className="pixel-canvas"
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}

export default App
