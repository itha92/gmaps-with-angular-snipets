/// <reference types="@types/googlemaps" />
import {Component, OnInit, Input, OnChanges, SimpleChanges, SimpleChange, Output, EventEmitter, ViewChild} from '@angular/core';
import {MapLayerService} from '../map-layer.service';
import {LayersComponent} from '../layers/layers.component';
import {NgbModal, NgbModalConfig} from '@ng-bootstrap/ng-bootstrap';
import {MarkerModalComponent} from '../../shared/marker-modal/marker-modal.component';
import {SmallBusinessModalComponent} from '../../shared/small-business-modal/small-business-modal.component';
import {LatLngBounds} from '@agm/core/map-types';
import {Observable} from 'rxjs';
import {debounceTime, distinctUntilChanged, switchMap} from 'rxjs/operators';
import {ExploreService} from '../../services/explore.service';
import {ControlPosition} from '@agm/core/services/google-maps-types';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit, OnChanges {

  showMap = false;
  showList = true;
  // @Input() showMap: boolean;

  map: any;
  public zoomLevel = 11;
  public lat = 39.833333;
  public lng = -98.583333;
  public initialSquare: LatLngBounds;
  public getting_data = true;

  @ViewChild(LayersComponent) layerComponent;
  @Input() tracts$: any;
  @Input() layer_data$: any;
  @Input() zipCodes$: any;
  @Input() otherCharities$: any;
  @Input() craCharities$: any;
  @Output() requestDataEmitter: EventEmitter<any> = new EventEmitter();
  @Output() searchDataEmitter: EventEmitter<any> = new EventEmitter();
  @Output() cancelRequests: EventEmitter<any> = new EventEmitter();
  @Output() gotoMapView: EventEmitter<any> = new EventEmitter();
  @Output() getZipCodesEmitter: EventEmitter<any> = new EventEmitter();
  @Output() getTractsEmitter: EventEmitter<any> = new EventEmitter();
  @Output() changed: EventEmitter<any> = new EventEmitter();
  @Output() layersEmitter: EventEmitter<any> = new EventEmitter();
  public searchText;
  public layers;
  public tracts_ids = [];
  public geoJson: any;
  public outside = 0;
  public inlayers;

  public currentShade = '';
  public showMaxZoomAlert = false;

  public clickedAreas = [];
  public iconCharities = './assets/img/place.png';
  public clusterIcon = './assets/img/m';
  public iconUrl = './assets/img/tract_icon.png';
  public mapMarkerUrl = './assets/img/map-marker.png';
  public iconBankUrl = './assets/img/bank.png';
  public iconSmBusiness = './assets/img/small-business-icon.png';
  public showRoads = 'on';
  public showCities = 'on';
  public showCensusLabels = false;
  public showTracts = false;
  public mapStyle = [
    {
      featureType: 'road',
      stylers: [
        {visibility: this.showRoads}
      ],
      height: '300px'
    },
    {
      featureType: 'administrative',
      stylers: [
        {visibility: this.showCities}
      ]
    }
  ];

  public streetViewOptions = {
    position: ControlPosition.RIGHT_CENTER
  };

  public panControlOptions = {
    position: ControlPosition.RIGHT_CENTER
  };

  public streetViewVisible = false;

  readonly searchTextResult = (text$: Observable<string>): Observable<string[]> =>
    text$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((result: string[]) => this.layerService.getSearchResultsByAddress(this.searchText)))

  readonly formatSearchByText = (result: string) => result;

  constructor(
    private mapLayerService: MapLayerService,
    private modalService: NgbModal,
    private layerService: ExploreService,
    config: NgbModalConfig
  ) {
    window['initialShade'] = 'none';
    config.backdrop = 'static';
  }

  ngOnInit() {
    if (sessionStorage.getItem('lat')) {
      this.lat = +sessionStorage.getItem('lat');
      this.lng = +sessionStorage.getItem('lng');
      this.zoomLevel = +sessionStorage.getItem('zoomLevel');
      if (this.zoomLevel >= 14 ) {
        setTimeout(() => {
          this.requestData();
        }, 300);
      }
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          this.lat = pos.lat;
          this.lng = pos.lng;
        }, () => {
          console.log('error');
        });
      } else {
        console.log('not supported');
      }
    }
  }

  moveMapTo(result) {
    let res;
    if (result.item) {
      res = result.item;
    } else {
      res = result;
    }
    this.layerService.getSearchResultsByText(res).subscribe(
      data => {
        this.lat = data[0].coordinates.lat;
        this.lng = data[0].coordinates.lon;
        switch (data[0].types[0]) {
          case 'country':
            this.zoomLevel = 6;
            break;
          case 'administrative_area_level_1':
            this.zoomLevel = 8;
            break;
          case 'locality':
            this.getting_data = true;
            this.zoomLevel = 13;
            break;
          case 'street_address':
            this.getting_data = true;
            this.zoomLevel = 15;
            break;
          case 'premise':
            this.getting_data = true;
            this.zoomLevel = 16;
            break;
          case 'route':
            this.getting_data = true;
            this.zoomLevel = 16;
            break;
          case 'establishment':
            this.zoomLevel = 16;
            break;
          case 'airport':
            this.zoomLevel = 16;
            break;
          case 'neighborhood':
            this.zoomLevel = 16;
            break;
          default:
            this.zoomLevel = 8;
            break;
        }
      },
      error => {
        console.log('error', error);
      }
    );
  }

  mapReady(event) {
    this.map = event;
  }

  loadNewData() {
    this.clearMap();
    this.requestData();
    this.changed.emit(true);
  }

  cancelPreviousRequests() {
    this.cancelRequests.emit(true);
  }

  refreshMap() {
    this.showTracts = false;
    setTimeout(() => {
      this.showTracts = true;
    }, 300);
  }

  setZoomLevel(event) {
    this.zoomLevel = event;
    if (this.zoomLevel === 14) {
      if (this.getting_data) {
        this.initialSquare = this.map.getBounds();
        this.requestData();
        this.getting_data = false;
      }
    }
    if (this.zoomLevel >= 14 && this.getting_data) {
      this.initialSquare = this.map.getBounds();
      this.requestData();
      this.getting_data = false;
    }

    if (this.zoomLevel >= 22) {
      this.showMaxZoomAlert = true;
    } else {
      this.showMaxZoomAlert = false;
    }

    if (this.zoomLevel < 12) {
      this.clearMap();
    }

    this.updateMapData();
  }

  boundsChange(event) {
    if (this.initialSquare) {
      if (this.initialSquare.contains(event.getNorthEast()) &&
      this.initialSquare.contains(event.getSouthWest()) &&
      this.initialSquare.contains(event.getCenter())) {
      } else {
        if (this.getting_data) {
          this.initialSquare = this.map.getBounds();
          if (this.zoomLevel >= 14) {
            this.requestData();
            this.getting_data = false;
            this.changed.emit(true);
          }
        }
      }
    }
    this.updateMapData();
  }

  clearMap() {
    this.map.data.setMap(null);
    delete this.layer_data$;
    delete this.tracts$;
    delete this.zipCodes$;
    delete this.otherCharities$;
    delete this.craCharities$;
    this.getting_data = true;
  }

  requestData() {
    let active_layers = [];
    this.inlayers.forEach(x => {
      if (x.active) {
        active_layers.push(x.layer);
      }
    });
    const payload = {
      zoom_level: this.zoomLevel,
      center: {
        lat: this.map.getCenter().lat(),
        lng: this.map.getCenter().lng()
      },
      corners: {
        ne: [this.map.getBounds().getNorthEast().lat(), this.map.getBounds().getNorthEast().lng()],
        sw: [this.map.getBounds().getSouthWest().lat(), this.map.getBounds().getSouthWest().lng()],
      },
      layers: active_layers
    };
    this.requestDataEmitter.emit(payload);
  }

  layerClicked(event) {
    if (this.clickedAreas.indexOf(event.featureData) === -1) {
      this.clickedAreas.push(event.featureData);
    }
  }

  showClickedTract(event) {
    if (this.clickedAreas.indexOf(event.feature) === -1) {
      this.clickedAreas.push(event.feature);
    }
  }

  showModal(event?, ein_id?) {
    const modalRef = this.modalService.open(MarkerModalComponent, {centered: true, size: 'lg'});
    if (event) {
      modalRef.componentInstance.charity = event;
    }
    if (ein_id) {
      modalRef.componentInstance.charity_ein = ein_id;
    }
    modalRef.componentInstance.emitService.subscribe((emmitedValue) => {
      this.lat = emmitedValue.latitude;
      this.lng = emmitedValue.longitude;
      this.zoomLevel = 20;
    });
  }

  showSmallBusinessModal(event) {
    const modalRef = this.modalService.open(SmallBusinessModalComponent, {centered: true, size: 'lg'});
    modalRef.componentInstance.small_business = event;
  }

  styleFeatureZipCode(feature) {
    return {
      strokeColor: '#000',
      strokeWeight: 0.5,
      fillColor: '#006837',
      fillOpacity: 0,
      scale: 1
    };
  }

  public styleFeature(feature) {
    let color, scale, fillOpacity;
    switch (window['initialShade']) {
      case 'none':
        color = '#fff';
        scale = 1;
        fillOpacity = 0;
        break;
      case 'income':
        switch (feature.getProperty('income_level_identifier')) {
          case 0:
            color = '#006837';
            break;
          case 1:
            color = '#2e8352';
            break;
          case 2:
            color = '#d1e4b1';
            break;
          case 3:
            color = '#e8f1be';
            break;
          case 4:
            color = '#ffffcc';
            break;
          default:
            color = '#a0a0a0';
            break;
        }
        scale = Math.pow(feature.getProperty('income_level_identifier'), 2);
        fillOpacity = 0.4;
        break;
      case 'minority':
        const minority = parseFloat(feature.getProperty('minority_pct'));
        if (minority > 0 && minority <= 10) {
          color = '#ffffcc';
        } else if (minority > 10 && minority <= 25) {
          color = '#e8f1be';
        } else if (minority > 25 && minority <= 50) {
          color = '#d1e4b1';
        } else if (minority > 50 && minority <= 75) {
          color = '#2e8352';
        } else if (minority > 75) {
          color = '#006837';
        } else {
          color = '#a0a0a0';
        }
        scale = 1;
        fillOpacity = 0.4;
        break;

      case 'satellite':
        color = '#fff';
        scale = 1;
        fillOpacity = 0;
        return {
          strokeColor: '#4ad048',
          strokeWeight: 6,
          fillColor: color,
          fillOpacity: fillOpacity,
          scale: scale
        };
        break;

      default:
        color = '#fff';
        scale = 1;
        fillOpacity = 0.2;
        break;
    }

    return {
      strokeColor: '#000',
      strokeWeight: 0.5,
      fillColor: color,
      fillOpacity: fillOpacity,
      scale: scale
    };

  }

  public toggleRoads() {
    if (this.showRoads === 'on') {
      this.showRoads = 'off';
      this.mapStyle[0].stylers = [{visibility: 'off'}];
    } else {
      this.mapStyle[0].stylers = [{visibility: 'on'}];
      this.showRoads = 'on';
    }
    this.map.setOptions({styles: this.mapStyle});
  }

  public toggleCities() {
    if (this.showCities === 'on') {
      this.mapStyle[1].stylers = [{visibility: 'off'}];
      this.showCities = 'off';
    } else {
      this.mapStyle[1].stylers = [{visibility: 'on'}];
      this.showCities = 'on';
    }
    this.map.setOptions({styles: this.mapStyle});
  }

  toggleTracts() {
    this.showTracts = this.inlayers[1].active;
  }

  toggleCensusLabels() {
    this.showCensusLabels = !this.showCensusLabels;
  }

  updateShadeTo(color) {
    if (color !== window['initialShade'] && this.showTracts) {
      this.currentShade = color;
      window['initialShade'] = color;
      this.refreshMap();
    }
  }

  toggleMapView() {
    if (this.map.getMapTypeId() === 'roadmap') {
      this.map.setMapTypeId('satellite');
    } else {
      this.map.setMapTypeId('roadmap');
    }
  }

  toggleLayersInMap(event) {
    this.layers = event;
    this.inlayers = event;
    this.layersEmitter.emit(event);
  }

  toggleZipCodes() {
    this.getZipCodesEmitter.emit(true);
  }

  isLayerActiveById(id) {
     const layer = this.inlayers.find(l => l.id === id);
     return layer.active;
  }

  updateMapData() {
    sessionStorage.setItem('lat', this.map.getCenter().lat());
    sessionStorage.setItem('lng', this.map.getCenter().lng());
    sessionStorage.setItem('zoomLevel', this.zoomLevel.toString());
  }

  adjustCenterAndZoom(points) {
    let bounds = new google.maps.LatLngBounds;
    points.attributes.counties.forEach(element => {
      let n = new google.maps.LatLng(element.ycenter, element.xcenter);
      bounds.extend(n);
    });
    this.map.fitBounds(bounds); // auto zoom
    this.map.panToBounds(bounds); // auto-center
  }

}
