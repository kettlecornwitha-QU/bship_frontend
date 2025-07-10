import { useEffect, useState } from "react"
import "./App.css"

//const GRID_SIZE = 10
const BACKEND_URL = "http://127.0.0.1:5000"

function scoreToColor(score: number): string {
	const maxScore = 34
	const clamped = Math.max(0, Math.min(score, maxScore))
	const ratio = clamped / maxScore

	const hue = 240 - 240 * ratio
	const saturation = 55
	const lightness = 35

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

type PromptState = {
	message: string
	onYes: () => void
	onNo: () => void
}

function App() {
	const [gameId, setGameId] = useState<string | null>(null)
	const [grid, setGrid] = useState<any[][]>([])
	const [scores, setScores] = useState<number[][]>([])
	const [loading, setLoading] = useState(true)
	const [selected, setSelected] = useState<[number, number] | null>(null)
	const [, setMessage] = useState<string | null>(null)
	const [prompt, setPrompt] = useState<PromptState | null>(null)
	const [selectingSunk, setSelectingSunk] = useState(false)
	const [sunkenSquares, setSunkenSquares] = useState<[number, number][]>([])
  const [lastHitSquare, setLastHitSquare] = useState<[number, number] | null>(null)

	useEffect(() => {
		const createGame = async () => {
			const res = await fetch(`${BACKEND_URL}/new_game`, { method: "POST" })
			const data = await res.json()
			setGameId(data.game_id)
		}
		createGame()
	}, [])

	useEffect(() => {
		if (!gameId) return
		const fetchBoard = async () => {
			setLoading(true)
			const res = await fetch(`${BACKEND_URL}/board?game_id=${gameId}`)
			const data = await res.json()
			setGrid(data.grid)
			setScores(data.scores)
			setLoading(false)
		}
		fetchBoard()
	}, [gameId])

	const handleShoot = () => {
		if (!gameId || !selected) return
		const [row, col] = selected
		setPrompt({
			message: "Was it a hit?",
			onYes: () => {
				setPrompt(null)
				handleHit(row, col, true)
			},
			onNo: () => {
				setPrompt(null)
				handleHit(row, col, false)
			},
		})
	}

  const handleHit = (row: number, col: number, wasHit: boolean) => {
    if (!gameId) return
    if (!wasHit) {
      submitShot(row, col, false)
      return
    }
  
    setGrid(prev =>
      prev.map((r, rIdx) =>
        r.map((cell, cIdx) =>
          rIdx === row && cIdx === col ? { ...cell, shot: true, hit: true } : cell
        )
      )
    )
  
    setPrompt({
      message: "Was a ship sunk?",
      onYes: () => {
        setPrompt(null)
        setSelectingSunk(true)
        setLastHitSquare([row, col])
        setSunkenSquares([[row, col]])
      },
      onNo: () => {
        setPrompt(null)
        submitShot(row, col, true, false)
      },
    })
  }

	const submitShot = async (
		row: number,
		col: number,
		hit: boolean,
		sunk?: boolean
	) => {
		const body: any = {
			game_id: gameId,
			coords: [row, col],
			hit,
			sunk,
		}
		if (sunk) {
			body.sunk_coords = sunkenSquares
		}
		const res = await fetch(`${BACKEND_URL}/shoot`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
		const data = await res.json()
		setSelected(null)
		setSunkenSquares([])
		setSelectingSunk(false)
		const boardRes = await fetch(`${BACKEND_URL}/board?game_id=${gameId}`)
		const boardData = await boardRes.json()
		setGrid(boardData.grid)
		setScores(boardData.scores)
		if (data.message || data.error) {
			setMessage(data.message || data.error)
		}
	}

	const submitSunkSquares = async () => {
    if (!gameId || sunkenSquares.length === 0 || !lastHitSquare) return
  
    const [row, col] = lastHitSquare
    await submitShot(row, col, true, true)
  }

	const handleUndo = async () => {
		if (!gameId) return
		await fetch(`${BACKEND_URL}/undo`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ game_id: gameId }),
		})
		const res = await fetch(`${BACKEND_URL}/board?game_id=${gameId}`)
		const data = await res.json()
		setGrid(data.grid)
		setScores(data.scores)
		setSelected(null)
		setSunkenSquares([])
		setSelectingSunk(false)
	}

	if (loading || !grid.length || !scores.length) {
		return <div style={{ padding: "1rem", fontSize: "1.25rem" }}>Loading game...</div>
	}

	return (
		<div className="app-container">
			{prompt && (
				<div className="overlay">
					<div className="prompt">
						<p>{prompt.message}</p>
						<button onClick={prompt.onYes} style={{ marginRight: "1rem" }}>Yes</button>
						<button onClick={prompt.onNo}>No</button>
					</div>
				</div>
			)}

			<div className="inner-container">
				<h1 className="title">Battleship</h1>
				{/* {message && <div className="message">{message}</div>} */}

				<div className="board">
					{grid.slice().reverse().map((row, rIdx) => {
						const actualRow = grid.length - 1 - rIdx
						return row.map((square, cIdx) => {
							const key = `${actualRow}-${cIdx}`
							const shot = square.shot
							const hit = square.hit
							const sunk = square.sunk
							const isSelected = selected?.[0] === actualRow && selected?.[1] === cIdx
							const isSunkSelected = sunkenSquares.some(([r, c]) => r === actualRow && c === cIdx)

							let classNames = "square"
							if (sunk) classNames += " sunk"
							else if (hit) classNames += " hit"
							else if (shot) classNames += " shot"
							if (!shot && isSelected) classNames += " selected"
							if (selectingSunk && isSunkSelected) classNames += " sunken-selecting"

							let content: string | number | null = scores[actualRow][cIdx]
							if (shot && sunk) content = "X"
							else if (shot && hit) content = "●"
							else if (shot) content = "○"

							return (
								<div
									key={key}
									className={classNames}
									onClick={() => {
										if (selectingSunk) {
											const already = sunkenSquares.some(([r, c]) => r === actualRow && c === cIdx)
											if (already) {
												setSunkenSquares(prev => prev.filter(([r, c]) => !(r === actualRow && c === cIdx)))
											} else {
												setSunkenSquares(prev => [...prev, [actualRow, cIdx]])
											}
										} else if (!shot) {
											setSelected([actualRow, cIdx])
										}
									}}
                  style={{
                    backgroundColor:
                      !shot && typeof content === "number" ? scoreToColor(content) : undefined,
                    color:
                      !shot && typeof content === "number" ? "white" : undefined,
                  }}
								>
									{content}
								</div>
							)
						})
					})}
				</div>

				<div className="buttons-container">
					{selected && !selectingSunk && (
						<button onClick={handleShoot}>Shoot selected square</button>
					)}
					{selectingSunk && (
						<button onClick={submitSunkSquares}>Submit sunken ship</button>
					)}
					{grid.some(row => row.some(cell => cell.shot)) && (
            <button onClick={handleUndo}>Undo</button>
          )}
				</div>
			</div>
		</div>
	)
}

export default App