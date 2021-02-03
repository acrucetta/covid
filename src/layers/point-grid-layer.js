// Copyright (c) 2020 Urban Computing Foundation

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import {CompositeLayer} from '@deck.gl/core';
import {ScatterplotLayer} from '@deck.gl/layers';
import Supercluster from 'supercluster';
import { sortBy } from 'lodash';
import * as d3 from 'd3-scale';

function getIconName(value, count) {
  const num = count === undefined ? 1 : count
  let val = Math.round(value/num)

  return isNaN(val) ? '' : `${val}`;
}

const hospitalColorscale = d3.scaleLinear()
  .domain([0, 100, 10e6])
  .range(['SkyBlue','red', 'red'])

function getIconColor(value) {
  if (isNaN(value)) {
    return [0,0,0]
  } else {
    return hospitalColorscale(value).split('(')[1].split(')')[0].split(',').map(d => +d)
  }
}

const svgToDataURL = (svg) => {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}


const generatePoints = (points, zoom) => {
    const dimension = Math.ceil(Math.sqrt(points.children.length));
    const center = points.geometry.coordinates;
    const dist = (1/(2**(zoom/1.8)))*150;

    const yStep = (360/40075)*dist;
    const xStep = (360/40075)*dist;

    const offsetX = dimension % 2 === 0 ? (dimension-1)*xStep/2 : (Math.floor(dimension/2))*xStep
    const offsetY = dimension % 2 === 0 ? (dimension-1)*yStep/2 : (Math.floor(dimension/2))*yStep

    const cleanPoint = zoom <= 7 ? sortBy(points.children, d => d.properties.value) : points.children
    return zoom > 11 ? 
        cleanPoint.map((data, idx) => ({
          coords: data.geometry.coordinates,
          radius: data.properties.scale,
          value: data.properties.value,
          GEOID: data.properties.GEOID
      }))
      : cleanPoint.map((data, idx) => ({
        coords: [
            center[0]+(xStep*(idx%dimension))-offsetX,
            center[1]-(yStep*(Math.floor(idx/dimension)))+offsetY
        ],
        radius: data.properties.scale,
        value: data.properties.value,
        GEOID: data.properties.GEOID
    }))
}

export default class PointGridLayer extends CompositeLayer {
  shouldUpdateState({changeFlags}) {
    return changeFlags.somethingChanged;
  }

  updateState({props, oldProps, changeFlags}) {
    const rebuildIndex = changeFlags.dataChanged || props.sizeScale !== oldProps.sizeScale;
    const z = Math.floor(this.context.viewport.zoom);
    if (rebuildIndex) {
      const index = new Supercluster(
        {
          maxZoom: 30, 
          radius: props.sizeScale/(z*0.5)
        }
      );
      

      index.load(
        props.data.map(d => {
            return {
              geometry: {coordinates: props.getPosition(d)},
              value: d.value,
              properties: d
            }
        })
      );
      this.setState({index});
    }

    const clusterData = this.state.index.getClusters([-180, -85, 180, 85], z)
      .filter(d => d.id)
      .map(d => ({
        geometry: d.geometry,
        children: this.state.index.getLeaves(d.id, 1000)
      }))
      .map(d => generatePoints(d, this.context.viewport.zoom))
      .flat()
    if (rebuildIndex || z !== this.state.z) {

      this.setState({
        data: clusterData,
        // data: this.state.index.getClusters([-180, -85, 180, 85], z),
        z
      });
    }
  }


  getPickingInfo({info, mode}) {
    const pickedObject = info.object && info.object.properties;
    if (pickedObject) {
      if (pickedObject.cluster && mode !== 'hover') {
        info.objects = this.state.index
          .getLeaves(pickedObject.cluster_id, 25)
          .map(f => f);
      }
      info.object = pickedObject;
    }
    return info;
  }

    renderLayers() {
        const {data, z} = this.state;
        const {onHover} = this.props;
        
        return new ScatterplotLayer(
            this.getSubLayerProps({
              id: 'scatterplot grid',
              data,
              onHover,
              opacity: 0.8,
              stroked: false,
              filled: true,
              radiusScale: (24-(z**(2*z/24)))*z,
              radiusUnits:'meters',
              radiusMinPixels: 2,
              lineWidthMinPixels: 1,
              getPosition: d => d.coords,
              getRadius: d => Math.sqrt(d.radius),
              getFillColor: d => getIconColor(d.value),
              getLineColor: d => [15,15,15,200],
            })
        )
    }
}