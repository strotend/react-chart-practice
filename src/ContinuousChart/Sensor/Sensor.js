import PropTypes from "prop-types"
import React from "react"

const initialState = {
	mouseX: undefined,
	mouseY: undefined,
	x: undefined,
	ys: undefined,
}

export default
class Sensor extends React.Component {

	static propTypes = {
		width: PropTypes.number,
		height: PropTypes.number,
		padding: PropTypes.object,
		xScale: PropTypes.func,
		yScale: PropTypes.func,
		y1Scale: PropTypes.func,

		xFormat: PropTypes.func,
		points: PropTypes.array,
	}

	state = initialState

	sensorRectRef = React.createRef()

	findPoint = (mouseX) => {
		const point = findClosestPoint(
			this.props.points.filter(({points}) => points.length),
			+this.props.xScale.invert(mouseX)
		)
		return point && Number.isFinite(point.x) ? point : {}
	}

	onMouseEvent = ({clientX, clientY}) => {
		const sensorRect = this.sensorRectRef.current

		if (sensorRect) {
			const mouseX = clientX - sensorRect.getBoundingClientRect().left
			const mouseY = clientY - sensorRect.getBoundingClientRect().top
			const {x, points} = this.findPoint(mouseX)
	
			this.setState({mouseX, mouseY, x, points})
		}
	}

	render() {
		const {width, height} = this.props

		return (
			<g
				onMouseEnter={this.onMouseEvent}
				onMouseMove={this.onMouseEvent}
				onMouseLeave={() => this.setState(initialState)}
				style={{ pointerEvents: "all" }}
			>
				<rect ref={this.sensorRectRef}
					width={String(width)} height={String(height)}
					style={{ fill: "none" }}
				/>
				{this.renderChildComponents({...this.props, ...this.state})}
			</g>
		)
	}

	shouldRenderChildComponents = () => {
		const {mouseX, mouseY, points} = this.state
		return Number.isFinite(mouseX + mouseY) && (points && points.length)
	}

	renderChildComponents = (props) => {
		return this.shouldRenderChildComponents()
			? [].concat(this.props.children || [])
				.map((child, index) => {
					child = child || {type: () => null, props: {}}
					return <child.type key={`sensor-child-${index}`} {...{...props, ...child.props}} />
				})
			: null
	}

}

function findClosestPoint(points, x, closestPoint, leftIdx, rightIdx) {
	closestPoint = closestPoint || {index: -1, x: -Infinity}
	leftIdx = Number.isFinite(leftIdx) ? leftIdx : 0
	rightIdx = Number.isFinite(rightIdx) ?  rightIdx : points.length - 1

	const midIdx = Math.floor((rightIdx + leftIdx) / 2)
	const point = points[midIdx] || {}

	closestPoint = Math.abs(x - point.x) <= Math.abs(x - closestPoint.x)
		? point
		: closestPoint
	if (point.x === x) return point
	if (leftIdx >= rightIdx) return closestPoint
	if (point.x < x) return findClosestPoint(points, x, closestPoint, midIdx + 1, rightIdx)
	if (point.x > x) return findClosestPoint(points, x, closestPoint, leftIdx, midIdx)
}
