import PropTypes from "prop-types"
import React from "react"
import styled from "styled-components"
import {
	schemeCategory10 as d3DefaultColors,
	scaleLinear,
	scaleUtc,
} from "d3"

import {XAxis, YAxis, Path, Sensor} from "./"

const StyledSVG = styled.svg`
	text {
		font-family: sans-serif;
	}
`

export default
class ContinuousChart extends React.Component {

	static propTypes = {
		width: PropTypes.number.isRequired,
		height: PropTypes.number.isRequired,
		padding: PropTypes.string,
		paddingTop: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
		paddingRight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
		paddingBottom: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
		paddingLeft: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
		colors: PropTypes.array,
	}

	static defaultProps = {
		width: 0,
		height: 0,
		colors: d3DefaultColors,
	}

	componentWillMount() {
		enableNodeListForEach()
	}

  render() {
		const {width, height} = this.props
		const commonProps = {
			width, height, padding: this.getPadding(),
			...this.getScales()
		}

    return (
			<StyledSVG
				width={String(width)} height={String(height)}
			>
				{this.renderYAxes(commonProps)}
				{this.renderXAxes(commonProps)}
				{this.renderCharts(commonProps)}
				{this.renderSensor(commonProps)}
			</StyledSVG>
    )
	}

	renderXAxes = (commonProps = {}) => {
		return this.getChildren(XAxis).slice(0, 1)
			.map((child, index) => (
				<child.type key={`axis-x-${index}`} {...{
					...commonProps,
					...child.props,
				}} />
			))
	}
	renderYAxes = (commonProps = {}) => {
		return this.getChildren(YAxis).slice(0, 2)
			.map((child, index, yAxes) => (
				<child.type key={`axis-y-${index}`} {...{
					axisIndex: index,
					axisCount: yAxes.length,
					...commonProps,
					...child.props,
				}} />
			))
	}
	renderCharts = (commonProps = {}) => {
		const chartProps = this.getChartProps()
		return this.getChildren(Path)
			.map((child, index) => (
				<child.type key={`chart-${index}`} {...{
					...commonProps,
					...chartProps[index],
				}} />
			))
	}
	renderSensor = (commonProps = {}) => {
		return this.getChildren(Sensor)
			.map((child, index) => (
				<child.type key={`sensor-${index}`} {...{
					...commonProps,
					...this.getSensorProps(),
					...child.props,
				}} />
			))
	}

	getChildren = (types = []) => {
		types = [].concat(types)
		return [].concat(this.props.children)
			.map(({type, props, ...otherProps}) => ({
				type: (type || (() => null)),
				props: (props || {}),
				...otherProps,
			}))
			.filter(({type}) => !types.length || types.includes(type) || types.includes(type.name))
	}

	getYAxisProps = (axisName) => {
		const yAxisProps = this.getChildren(YAxis).slice(0, 2)
			.map(({props}) => props)
			.map(({name: axis, ...yAxisProps}, axisIndex, axes) => ({
				axis, axisIndex,
				yPrefix: yAxisProps.tickPrefix,
				yPostfix: yAxisProps.tickPostfix,
			}))
		const useFirstYAxis = !(axisName && yAxisProps.some((({axis}) => axis === axisName)))
		return yAxisProps.find(({axis}) => (useFirstYAxis || axis === axisName))
	}

	getChartProps = () => {
		return groupChartProps(
			this.getChildren(Path)
			.map(({props}) => props)
			.map(({axis, points, ...otherProps}, index) => ({
				name: `y${index + 1}`,
				color: this.props.colors[index % this.props.colors.length],
				...this.getYAxisProps(axis),
				...otherProps,
				points: formatPoints(points),
			}))
		)
	}

	getSensorProps = () => {
		const [xAxisProps] = this.getChildren(XAxis).slice(0, 1).map(({props}) => props || {})

		const chartProps = this.getChartProps()
		const points = chartProps.reduce((points, props) => [...points, ...props.points], [])
		const xs = [...new Set(points.map(({x}) => x))].sort((a, b) => (a - b))

		return {
			xFormat: (xAxisProps || {}).tickFormat,
			points: xs.map((x) => ({
				x,
				points: formatPoints(
					chartProps.reduce((points, {points: currentPoints, ...chartProps}) => [
						...points,
						{...chartProps, ...(findPoint(currentPoints, x) || {})},
					], [])
				),
			})),
		}
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

	getScales = () => {
		const {width, height} = this.props

		const padding = this.getPadding()
		const {xDomain, yDomain, y1Domain} = this.getDomains()

		const {xAxisValues} = this.getValuesByAxis()
		const dayInterval = 1000 * 60 * 60 * 24
		const intervals = xAxisValues
			.map((x, index, xAxisValues) => Math.abs(x - (xAxisValues[index - 1] || 0)))
			.filter((interval) => interval)

		return {
			xScale: ((Math.min(...intervals) % dayInterval) ? scaleLinear() : scaleUtc())
				.domain(xDomain)
				.range([padding.left + 10, width - (padding.right + 10)]),
			yScale: scaleLinear()
				.domain(yDomain)
				.range([height - padding.bottom, padding.top]),
			y1Scale: scaleLinear()
				.domain(y1Domain)
				.range([height - padding.bottom, padding.top]),
		}
	}

	getDomains = () => {
		const {xAxisValues, yAxis0Values, yAxis1Values} = this.getValuesByAxis()

		const yAxis0Min = Math.min(0, ...yAxis0Values)
		const yAxis0Max = Math.max(0, ...yAxis0Values)
		const yAxis1Min = Math.min(0, ...yAxis1Values)
		const yAxis1Max = Math.max(0, ...yAxis1Values)

		const yRatio = Math.min(-yAxis0Min, yAxis0Max) / Math.max(-yAxis0Min, yAxis0Max)
		const y1Ratio = Math.min(-yAxis1Min, yAxis1Max) / Math.max(-yAxis1Min, yAxis1Max)

		const xDomain = [Math.min(...xAxisValues), Math.max(...xAxisValues)]
		switch (true) {
			case (!yAxis1Values || !yAxis1Values.length || (!yAxis1Min && !yAxis1Max)):
				return {
					xDomain,
					yDomain: [yAxis0Min, yAxis0Max],
					y1Domain: [0, 0]
				}
			case (-yAxis0Min < yAxis0Max && -yAxis1Min >= yAxis1Max):
			case (-yAxis0Min >= yAxis0Max && -yAxis1Min < yAxis1Max):
				return {
					xDomain,
					yDomain: [-Math.max(-yAxis0Min, yAxis0Max), Math.max(-yAxis0Min, yAxis0Max)],
					y1Domain: [-Math.max(-yAxis1Min, yAxis1Max), Math.max(-yAxis1Min, yAxis1Max)],
				}
			case (-yAxis0Min < yAxis0Max && -yAxis1Min < yAxis1Max):
			case (-yAxis0Min >= yAxis0Max && -yAxis1Min >= yAxis1Max):
				return {
					xDomain,
					yDomain: (yRatio >= y1Ratio) ? [yAxis0Min, yAxis0Max]
						: [
							-(-yAxis1Min < yAxis1Max ? y1Ratio : 1) * Math.max(-yAxis0Min, yAxis0Max),
							(-yAxis1Min >= yAxis1Max ? y1Ratio : 1) * Math.max(-yAxis0Min, yAxis0Max),
						],
					y1Domain: (yRatio < y1Ratio) ? [yAxis1Min, yAxis1Max]
						: [
							-(-yAxis0Min < yAxis0Max ? yRatio : 1) * Math.max(-yAxis1Min, yAxis1Max),
							(-yAxis0Min >= yAxis0Max ? yRatio : 1) * Math.max(-yAxis1Min, yAxis1Max),
						]
				}
		}
	}

	getValuesByAxis = () => {
		const chartProps = this.getChartProps()
		const points = chartProps.reduce((points, props) => [...points, ...props.points], [])

		const xAxes = this.getChildren(XAxis).slice(0, 1)
		const yAxes = this.getChildren(YAxis).slice(0, 2)

		const [xAxisValues] = !xAxes.length ? [points.map(({x}) => x)]
			: xAxes.reduce((xsArray, {props: axisProps = {}}, index) => [
				...xsArray,
				chartProps.reduce((xAxisValues, {points}) => [
					...xAxisValues,
					...points.map(({x, y0, y1}) => x),
					...(axisProps.tickValues || []),
				], [])
			], [])
		const [yAxis0Values, yAxis1Values] = !yAxes.length ? [points.map(({y1}) => y1), []]
			: yAxes.reduce((ysArray, {props: axisProps = {}}, index) => [
				...ysArray,
				chartProps
					.filter(({axis}) => (!index && !axis) || (axisProps.name === axis))
					.reduce((yAxis0Values, {points}) => [
						...yAxis0Values,
						...points.map(({x, y0, y1}) => y1),
						...(axisProps.tickValues || []),
					], [])
			], [])

		return {
			xAxisValues: [...new Set(xAxisValues)].sort((a, b) => (a - b)),
			yAxis0Values: [...new Set(yAxis0Values)].sort((a, b) => (a - b)),
			yAxis1Values: [...new Set(yAxis1Values)].sort((a, b) => (a - b)),
		}
	}

}

function enableNodeListForEach() {
	// https://developer.mozilla.org/en-US/docs/Web/API/NodeList/forEach#Polyfill
	// for MS IE and Edge
	if (window.NodeList && !NodeList.prototype.forEach) {
		NodeList.prototype.forEach = function (callback, thisArg) {
			thisArg = thisArg || window;
			for (var i = 0; i < this.length; i++) {
				callback.call(thisArg, this[i], i, this);
			}
		};
	}
}

function findPoint(points, x, leftIdx, rightIdx) {
	leftIdx = Number.isFinite(leftIdx) ? leftIdx : 0
	rightIdx = Number.isFinite(rightIdx) ?  rightIdx : points.length - 1

	const midIdx = Math.floor((rightIdx + leftIdx) / 2)
	const point = points[midIdx] || {}

	if (point.x === x) return point
	if (leftIdx >= rightIdx) return undefined
	if (point.x < x) return findPoint(points, x, midIdx + 1, rightIdx)
	if (point.x > x) return findPoint(points, x, leftIdx, midIdx)
}

function formatPoints(points) {
	const validateY = (number) => (typeof number === "number" && !Number.isNaN(number))
	return (points instanceof Array ? points : [])
		.map((point) => point || {})
		.map(({x, y, y0, y1, ...otherProps} = {}) => ({
			...otherProps,
			x,
			y0: (y0 || 0),
			y1: (validateY(y1) ? y1 : (validateY(y) ? y : null)),
		}))
		.filter(({x, y0, y1}) => Number.isFinite(x))
		.sort(({x: xA}, {x: xB}) => xA - xB)
}

function groupChartProps(chartProps) {
	chartProps = (chartProps || [])
	const pointsByGroup = {}
	const xValuesByGroup = chartProps
		.filter(({group}) => group)
		.reduce((xValuesByGroup, {group, points}) => ({
			...xValuesByGroup,
			[group]: [...new Set([
				...(xValuesByGroup[group] || []),
				...points.map(({x}) => x)
			])].sort((a, b) => a - b),
		}), {})
	return chartProps.map(({group, points, ...otherProps}) => ({
		...otherProps,
		group,
		points: !group ? points
			: xValuesByGroup[group].map((x) => {
				pointsByGroup[group] = (pointsByGroup[group] || {})
				const prevPoint = (pointsByGroup[group][x] || {})
				const currPoint = (points.find((point) => point.x === x) || {})
				return pointsByGroup[group][x] = {
					x,
					y0: (prevPoint.y1 || 0) + (currPoint.y0 || 0),
					y1: (prevPoint.y1 || 0) + (currPoint.y1 || 0),
				}
			})
	}))
}
