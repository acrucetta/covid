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
import {IconLayer} from '@deck.gl/layers';
import Supercluster from 'supercluster';
import * as d3 from 'd3-scale';

function getIconName(value, count) {
  const num = count === undefined ? 1 : count
  let val = Math.round(value/num)

  return isNaN(val) ? '' : `${val}`;
}

const colorScale = d3.scaleLinear()
  .domain([0, 100])
  .range(['blue','red'])

function getIconColor(value, count) {
  const num = count === undefined ? 1 : count
  let val = Math.round(value/num)
  if (isNaN(val)) {
    return [0,0,0]
  } else {
    return colorScale(val).split('(')[1].split(')')[0].split(',').map(d => +d)
  }
}


const svgToDataURL = (svg) => {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}


const generateSVG = (points) => {
  let dimension = Math.ceil(Math.sqrt(points.children.length))*10;

  return {
    
    geometry: points.geometry,
    dimension: dimension,
    points: points.children
  }
}

export default class IconClusterLayer extends CompositeLayer {
  shouldUpdateState({changeFlags}) {
    return changeFlags.somethingChanged;
  }

  updateState({props, oldProps, changeFlags}) {
    const rebuildIndex = changeFlags.dataChanged || props.sizeScale !== oldProps.sizeScale;
    if (rebuildIndex) {
      const index = new Supercluster(
        {
          maxZoom: 20, 
          radius: props.sizeScale,
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

    const z = Math.floor(this.context.viewport.zoom);
    const clusterData = this.state.index.getClusters([-180, -85, 180, 85], z)
      .filter(d => d.id)
      .map(d => ({
        geometry: d.geometry,
        children: this.state.index.getLeaves(d.id, 1000)
      }))
      .map(d=> generateSVG(d))
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
    const {data} = this.state;

    return new IconLayer(
        this.getSubLayerProps({
        id: 'icon2',
        data,
        getIcon: d => ({
            icon: `http://www.w3.org%2F2000%2Fsvg%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%3Crect%20width%3D%2210%22%20height%3D%2210%22%20x%3D%220%22%20y%3D%220%22%20fill%3D'%23ff0000'%2F%3E%2C%3Crect%20width%3D%2210%22%20height%3D%2210%22%20x%3D%2210%22%20y%3D%220%22%20fill%3D'%23ff0000'%2F%3E%2C%3Crect%20width%3D%2210%22%20height%3D%2210%22%20x%3D%2220%22%20y%3D%220%22%20fill%3D'%23ff0000'%2F%3E%2C%3Crect%20width%3D%2210%22%20height%3D%2210%22%20x%3D%220%22%20y%3D%221%22%20fill%3D'%23ff0000'%2F%3E%2C%3Crect%20width%3D%2210%22%20height%3D%2210%22%20x%3D%2210%22%20y%3D%221%22%20fill%3D'%23ff0000'%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3C%2Fsvg%3E`,
            width: d.dimension,
            height: d.dimension
        }),
        getPosition: d => d.geometry.coordinates,
        getSize: d => 20,
        sizeMinPixels: 20
        })
    )
    }
}