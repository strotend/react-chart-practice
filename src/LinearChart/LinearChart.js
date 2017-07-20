import "./LinearChart.css"

import * as d3 from "d3"

import Immutable from "immutable"
import PropTypes from "prop-types"
import React from "react"

export default
class LinearChart extends React.Component {

	static propTypes = {
		width: PropTypes.number.isRequired,
		height: PropTypes.number.isRequired,
		padding: PropTypes.string,
		paddingTop: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
		paddingRight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
		paddingBottom: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
		paddingLeft: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
		colorArray: PropTypes.array,
	}

	static defaultProps = {
		width: 0,
		height: 0,
		colorArray: d3.schemeCategory10,
	}

	pixelRatio = (window.devicePixelRatio || 1)

  render() {
		const {width, height} = this.props

    return (
			<svg
				className="linear-chart"
				width={String(width)} height={String(height)}
			>
				{this.renderAxes({
					width, height, padding: this.getPadding(),
					...this.getScales(),
				})}
				{this.renderCharts({
					bandWidth: this.getBandWidth(),
					...this.getScales(),
				})}
				{this.renderSensor({
					width, height, padding: this.getPadding(),
					...this.getScales(),
					...this.getXYs(),
					chartProps: this.getChartProps(),
				})}
			</svg>
    )
	}

	renderAxes = (props) => {
		return this.getChildren()
			.filter(({type = () => null}) => ["XAxis", "YAxis"].includes(type.name))
			.map((child, index) => {
				child = child || {type: () => null, props: {}}
				return <child.type key={`axis-${index}`} {...{...props, ...child.props}} />
			})
	}
	renderCharts = (props) => {
		const filtertedPointLists = this.getPointLists(true)
		const chartProps = this.getChartProps()
		return this.getChildren()
			.filter(({props = {}}) => props.pointList)
			.map((child, index) => (
				<child.type key={`chart-${index}`} {...{
					...chartProps[index], ...props, ...(child.props || {}),
					pointList: filtertedPointLists[index],
				}} />
			))
			.sort(({type: typeA}, {type: typeB}) => {
				const typeOrder = ["Bar", "Line"]
				return typeOrder.indexOf(typeA.name) - typeOrder.indexOf(typeB.name)
			})
	}
	renderSensor = (props) => {
		return this.getChildren()
			.filter(({type = () => null}) => ["Sensor"].includes(type.name))
			.map((child, index) => {
				child = child || {type: () => null, props: {}}
				return <child.type key={`sensor-${index}`} {...{...props, ...child.props}} />
			})
	}

	getChildren = () => {
		return [].concat(this.props.children)
			.reduce((children, child) => children.concat(child), [])
			.filter((child) => child)
	}

	getChartProps = () => {
		const {colorArray} = this.props
		const pointLists = this.getPointLists()
		const typeCounts = {}

		return this.getChildren()
			.filter(({props = {}}) => props.pointList)
			.map(({type = () => null, props = {}}, index) => ({
				name: `y${index + 1}`,
				color: colorArray[index % colorArray.length],
				...props,
				pointList: pointLists[index],
				chartIndex: index,
				type: type.name,
				typeIndex: (typeCounts[type.name] = (typeCounts[type.name] || 0) + 1) - 1,
			}))
			.map((props) => ({
				...props,
				typeCount: typeCounts[props.type],
			}))
	}

	getPointLists = (filter = false) => {
		const {width} = this.props
		const padding = this.getPadding()

		const chartWidth = width - (padding.left + padding.right)
		const chartPixels = chartWidth * this.pixelRatio

		return this.getChildren()
			.filter(({props = {}}) => props.pointList)
			.map(({props = {}}, index) => {
				return props.pointList
					.sort((pointA, pointB) => {
						if (pointA.get("x") > pointB.get("x")) return 1
						if (pointA.get("x") < pointB.get("x")) return -1
						return 0
					})
					.filter((point, index, pointList) => !(
						filter
						&& point && point.get("y") !== null      // do not filter null point
						&& index && index !== pointList.size - 1 // do not filter first and last point
						&& Math.floor(Math.random() * (props.pointList.size / chartPixels))
					))
			})
	}

	getPadding = () => {
		const {
			padding = "",
			paddingTop, paddingRight, paddingBottom, paddingLeft
		} = this.props

		const [top, right, bottom, left] = padding.split(" ")

		return {
			top: parseFloat(paddingTop || top || 0 ),
			right: parseFloat(paddingRight || right || top || 0),
			bottom: parseFloat(paddingBottom || bottom || top || 0),
			left: parseFloat(paddingLeft || left || right || top || 0),
		}
	}

	getBandWidth = () => {
		const {width} = this.props
		const {xScale} = this.getScales()
		const xs = [...new Set(
			this.getChartProps()
				.filter(({type}) => type === "Bar")
				.reduce((points, {pointList = Immutable.List()}) => points.concat(pointList.toJS()), [])
				.filter((point) => point && isFinite(point.y))
				.map(({x}) => x || 0)
		)]

		const min = Math.min(...xs)
		const max = Math.max(...xs)
		const intervals = xs
			.map((x, index, xs) => Math.abs(x - (xs[index - 1] || 0)))
			.filter((interval) => interval)

		const bandWidth = Math.max(1 / this.pixelRatio, Math.min(
			Math.abs(xScale(max) - xScale(max - Math.min(...intervals))),
			2 * Math.abs(xScale(min) - xScale.range()[0]),
			2 * Math.abs(xScale(max) - xScale.range()[1]),
		))

		return 0.8 * bandWidth
	}

	getScales = () => {
		const {width, height} = this.props

		const padding = this.getPadding()
		const {xDomain, yDomain} = this.getDomains()

		return {
			xScale: d3.scaleLinear()
				.domain(xDomain)
				.range([padding.left + 10, width - (padding.right + 10)]),
			yScale: d3.scaleLinear()
				.domain(yDomain)
				.range([height - padding.bottom, padding.top])
				.nice(),
		}
	}

	getDomains = () => {
		const {xs, ys} = this.getXYs()
		const xIntervals = xs
			.map((x, index, xs) => Math.abs(x - (xs[index - 1] || 0)))
			.filter((interval) => interval)

		return {
			xDomain: [
				Math.min(...xs) - Math.min(...xIntervals) / 2,
				Math.max(...xs) + Math.min(...xIntervals) / 2,
			],
			yDomain: d3.extent([0, ...ys]),
		}
	}

	getXYs = () => {
		const points = this.getPointLists()
			.reduce((points, pointList = Immutable.List()) => points.concat(pointList.toJS()), [])
			.filter((point) => point && isFinite(point.y))

		const sort = (a, b) => {
			if (a > b) return 1
			if (a < b) return -1
			return 0
		}

		return {
			xs: [...new Set(points.map(({x}) => x || 0))].sort(sort),
			ys: [...new Set(points.map(({y}) => y || 0))].sort(sort),
		}
	}

}
