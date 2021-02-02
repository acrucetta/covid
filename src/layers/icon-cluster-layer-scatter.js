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

const colorScale = d3.scaleLinear()
  .domain([0, 100])
  .range(['blue','red'])

function getIconColor(value) {
  if (isNaN(value)) {
    return [0,0,0]
  } else {
    return colorScale(value).split('(')[1].split(')')[0].split(',').map(d => +d)
  }
}


const svgToDataURL = (svg) => {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}


const generatePoints = (points, zoom) => {
    let dimension = Math.ceil(Math.sqrt(points.children.length));
    let center = points.geometry.coordinates;
    let dist = (1/(2**(zoom/1.8)))*100;

    let yStep = (360/40075)*dist;
    let xStep = (360/40075)*dist;

    let offsetX = dimension % 2 === 0 ? (dimension-1)*xStep/2 : (Math.floor(dimension/2))*xStep
    let offsetY = dimension % 2 === 0 ? (dimension-1)*yStep/2 : (Math.floor(dimension/2))*yStep

    let cleanPoint = sortBy(points.children, d => d.properties.value)
    return cleanPoint.map((data, idx) => ({
        coords: [
            center[0]+(xStep*(idx%dimension))-offsetX,
            center[1]-(yStep*(Math.floor(idx/dimension)))+offsetY
        ],
        radius: 1,
        color: getIconColor(data.properties.value)
    }))
}

export default class IconClusterLayer extends CompositeLayer {
  shouldUpdateState({changeFlags}) {
    return changeFlags.somethingChanged;
  }

  updateState({props, oldProps, changeFlags}) {
    const rebuildIndex = changeFlags.dataChanged || props.sizeScale !== oldProps.sizeScale;
    const z = Math.floor(this.context.viewport.zoom);
    if (rebuildIndex) {
      const index = new Supercluster(
        {
          maxZoom: 20, 
          radius: props.sizeScale/(z*0.8),
          map: (props) => ({value: props.value}),
          reduce: (accumulated, props) => { accumulated.value += props.value; }
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
          .map(f => f.properties);
      }
      info.object = pickedObject;
    }
    return info;
  }

    renderLayers() {
        const {data, z} = this.state;

        return new ScatterplotLayer(
            this.getSubLayerProps({
            id: 'test scatterplot',
            data,
            opacity: 0.8,
            stroked: true,
            filled: true,
            radiusScale: z**1.7,
            radiusMinPixels: 3,
            radiusMaxPixels: 100,
            lineWidthMinPixels: 1,
            getPosition: d => d.coords,
            getRadius: d => d.radius*20,
            getFillColor: d => d.color,
            getLineColor: d => [0, 0, 0],
            })
        )
    }
}