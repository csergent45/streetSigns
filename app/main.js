"use strict";
/* globals console: false, define: false, alert: false */


define([
  "dojo/query",
  "dojo/dom",
  "dojo/dom-class",
  "dojo/dom-style",
  "dojo/dom-attr",

  "dojox/validate",
  "dojox/validate/check",

  "esri/config",
  "esri/layers/FeatureLayer",
  "esri/InfoTemplate",
  "esri/graphic",
  "esri/dijit/Geocoder",
  "esri/dijit/LocateButton",
  "esri/dijit/Legend",
  "esri/tasks/GeometryService",
  "esri/tasks/query",

  "esri/geometry/Extent",
  "esri/layers/ArcGISDynamicMapServiceLayer",
  "esri/layers/ArcGISTiledMapServiceLayer",

  "bootstrap-map-js/js/bootstrapmap",

  "dijit/form/ValidationTextBox",
  "dijit/form/CheckBox",
  
  "dojo/on",
  "dojo/parser",
  "dojo/_base/lang",
  "dojo/string",

  "dojo-bootstrap/Collapse",
  "dojo-bootstrap/Dropdown",
  "dojo-bootstrap/Modal",
  "dojo-bootstrap/Alert",

  
  "dojo/domReady!"
], function (
  query, dom, domClass, domStyle, domAttr, validate, check,
  esriConfig, FeatureLayer, InfoTemplate, Graphic, Geocoder, LocateButton, Legend, GeometryService, esriQuery,
  Extent, ArcGISDynamicMapServiceLayer, ArcGISTiledMapServiceLayer,
  BootstrapMap, ValidationTextBox, CheckBox, on, parser, lang, string
) {


    /* The proxy comes before all references to web services */
    /* Files required for security are proxy.config, web.config and proxy.ashx 
    - set security in Manager to Private, available to selected users and select Allow access to all users who are logged in 
    (Roles are not required) 
    /* 
    The proxy section is defined on the ESRI sample. I have included it as 
    part of the documentation that reads that the measuring will not work. 
    I thought that might be important. 
    */

    // Proxy Definition Begin  
    //identify proxy page to use if the toJson payload to the geometry service is greater than 2000 characters.  
    //If this null or not available the project and lengths operation will not work.  
    // Otherwise it will do a http post to the proxy.  
    esriConfig.defaults.io.proxyUrl = "proxy.ashx";
    esriConfig.defaults.io.alwaysUseProxy = false;

    // Proxy Definition End  

    // declare geometry service  
    esriConfig.defaults.geometryService = new GeometryService("http://maps.decaturil.gov/arcgis/rest/services/Utilities/Geometry/GeometryServer");

    //Chris"s options  
    var initialExtent = new Extent({
        "xmin": 777229.03,
        "ymin": 1133467.92,
        "xmax": 848340.14,
        "ymax": 1185634.58,
        "spatialReference": {
            "wkid": 3435
        }
    });
    // app configuration  
    var config = {

        mapOptions: {
            showAttribution: false,
            sliderStyle: "small",
            extent: initialExtent,
            logo: false,
            sliderPosition: "bottom-right"
        },

        signLayerUrl: "http://maps.decaturil.gov/arcgis/rest/services/test/StreetSignTest/FeatureServer/0",
        
        supportLayerUrl: "http://maps.decaturil.gov/arcgis/rest/services/test/StreetSignTest/FeatureServer/1"

    };

   

    // app globals  
    var app = {};
   
   
    /* Ensure all e-mail fields are entered before opening e-mail */
    on(dom.byId("btnFeedback"), "click", function (e) {
        if (document.getElementById("eMail") == null || document.getElementById("eMail").value == ""
            || document.getElementById("subject") == null || document.getElementById("subject").value ==""
            || document.getElementById("comment") == null || document.getElementById("comment").value == "") 
        {
            alert("All fields are required!");
        } else {
            query("#feedbackModal").modal("hide");
            sendEmail();
            document.getElementById("eMail").value = "dsergent@decaturil.gov";
            document.getElementById("subject").value = "Street Signs";
            document.getElementById("comment").value = "";
        }
    });

    function sendEmail(ev) {

        var link = "mailto:" +  document.getElementById("eMail").value
             + "&subject=" + escape(document.getElementById('subject').value)
             + "&body=" + escape(document.getElementById('comment').value)  ;

        window.location.href = link;
        
    }

    on(dom.byId("lyrSigns"), "change", updateLayerVisibility);
    on(dom.byId("lyrSupports"), "change", updateLayerVisibility);

    function updateLayerVisibility() {
        app.signLayer.setVisibility(document.getElementById('lyrSigns').checked);
        app.supportLayer.setVisibility(document.getElementById('lyrSupports').checked);
    }


    on(dom.byId("btnCancelFeedback"), "click", function () {
        query("#feedbackModal").modal("hide");
    });

      
    app.collapseMenuToggleButton = dom.byId("collapseToggleButton");
    app.startEditAlert = dom.byId("startEditAlert");
    app.sidebar = dom.byId("sidebar");
    app.attributesModal = query("#attributesModal");
    app.attributesSignModal = query("#attributesSignModal");
    app.requestTypeSelect = query("#attributesModal [name=\"requesttype\"]")[0];
    // TODO: get these from the feature layer on load  
    app.severityFieldDomainCodedValuesDict = {
        "0": "Street Sign",
        "1": "Support"
        
    };
   
    

    var initAttributeForm = function () {
        
        var options = []; // options defined but never used
    };
   
    // initialize the map and add the feature layer  
    // and initialize map widgets  
    var initMap = function () {
        app.map = BootstrapMap.create("map", config.mapOptions);

        var tiled = new ArcGISTiledMapServiceLayer("http://maps.decaturil.gov/arcgis/rest/services/Aerial_2014_Tiled/MapServer");
        app.map.addLayer(tiled);

        // add operational layer  
        var operationalLayer = new ArcGISDynamicMapServiceLayer("http://maps.decaturil.gov/arcgis/rest/services/Public/InternetVector/MapServer", {
            "opacity": 0.5
        });
        app.map.addLayer(operationalLayer);

        /* Configure support layer */
        app.supportLayer = new FeatureLayer(config.supportLayerUrl, {
            mode: FeatureLayer.MODE_ONEDEMAND,
            //infoTemplate: new InfoTemplate(config.infoTemplate),
            outFields: ["*"]
        });

        /* Add support layer */
        app.map.addLayer(app.supportLayer);

        /* Configure sign layer */
        app.signLayer = new FeatureLayer(config.signLayerUrl, {
            mode: FeatureLayer.MODE_ONEDEMAND,
            outFields: ["*"]
        });

        /* Add sign Layer */
        app.map.addLayer(app.signLayer);
       
        /* Get support information on click */
        var supportId, type, address;
        app.supportLayer.on("click", function (evt) {
            supportId = evt.graphic.attributes.SUPPORTID;
            type = evt.graphic.attributes.TYPE;
            address = evt.graphic.attributes.ADDRESS;
            app.attributesModal.modal("show");
            document.getElementById("address").value = address;
            console.log(supportId);
            console.log(type);
            console.log(address);
        });

        app.geocoder = new Geocoder({
            map: app.map,
            autoComplete: true,
            arcgisGeocoder: {
                placeholder: "Address or Location"
            },
            "class": "geocoder"
        }, "geocoder");
        app.geocoder.startup();

        // Begin geolocate button  
        // add geolocate button to find the location of the current user  
        app.map.on("load", function () {
            app.locateButton = new LocateButton({
                map: app.map,
                highlightLocation: true,
                useTracking: true,
                enableHighAccuracy: true
            }, "locateButton");
            app.locateButton.clearOnTrackingStop = true;
            app.locateButton.startup();
            app.locateButton.locate();
        });
        // End geolocate button  


        app.legend = new Legend({
            map: app.map,
            layerInfos: [{
                title: app.supportLayer.name,
                layer: app.supportLayer
            }, {
                title: app.signLayer.name,
                layer: app.signLayer
            }]
        }, "legend");
        app.legend.startup();
        // TODO: other widgets, etc  
    };

    // hide nav dropdown on mobile  
    var hideDropdownNav = function (e) {
        if (query(".navbar-collapse.in").length > 0) {
            e.stopPropagation();
            app.collapseMenuToggleButton.click();
        }
    };
      
    

    // temporarily show alert when starting edits  
    // and then start listening for a map click  
    var startCaptureRequest = function (severity) {
        var listener;
        
        // NOTE: once user has clicked "x" to dismiss  
        // this alert, it will no longer show up  
        domStyle.set(app.startEditAlert, "display", "");
        setTimeout(function () {
            domStyle.set(app.startEditAlert, "display", "none");
        }, 3000);
        // save map point in app global and  
        listener = app.map.on("click", function (e) {
            listener.remove();
            // save map point in app global and  
            // show form to collect incident report  
            app.currentGeometry = e.mapPoint;
            
            if (severity === "0") {
                app.attributesSignModal.modal("show");

               
            } else if (severity === "1") {
                app.attributesModal.modal("show");
            }

            /* Query Begin */
            var query = new esriQuery();
            query.where = "CONDITION_ IS NOT NULL";
            query.returnGeometry = false;
            query.outFields = ["CONDITION_"]
            query.returnDistinctValues = true;
            app.signLayer(query, function (results) {
                array.forEach(results.features, function (feature) {
                    console.log(feature.attributes["CONDITION_"]);
                });
            });
            /* Query End */
        });
    };

    var stopCaptureRequest = function () {
          app.currentGeometry = null;
    };
    

    // get attributes from form and submit  
    var submitIncidentReport = function () {
        // NEED TO DETERMINE WHICH FORM IS OPEN AND CREATE A CONDITIONAL STATEMENT FOR INSERT.
        alert(domClass.contains("attributesModal", "in"));

        var attributes = {
            // TODO: not sure if this is needed  
            //requestreceived: null
        };
        var currentDate = new Date(); // current date is defined but never used.
        var graphic;
                
        
        graphic = new Graphic(app.currentGeometry);
        
        query("#attributesModal input, #attributesModal select, #attributesModal textarea").forEach(function (formInput) {
            attributes[formInput.name] = formInput.value;
        });
       
        // Form Validation - ensures that the values for the database are here if left blank
        if ((attributes.supportId === undefined) || (attributes.supportId === "")) {
            attributes.supportId = null;
        }
        if ((attributes.dateInv === undefined) || (attributes.dateInv === "")) {
            attributes.dateInv = null;
        }
        if ((attributes.addrCode === undefined) || (attributes.addrCode === "")) {
            attributes.addrCode = null;
        }        

        
        
        graphic.setAttributes(attributes);
        stopCaptureRequest();
        
        //console.log(attributes);  
        app.supportLayer.applyEdits([graphic], null, null).then(function (response) {
            console.log(response);
        });
    };

    // wire up the DOM events  
    var initEvents = function () {
        // listen for map clicks once severity is chosen  
        query(".report-btn-group .dropdown-menu a").on("click", function (e) {
            e.preventDefault();
            startCaptureRequest(domAttr.get(e.target, "data-value"));
            
        });

        // TODO show the feedback modal  
        query("a[href=\"#feedback\"]").on("click", function (e) {
            e.preventDefault();
            query("#feedbackModal").modal("show");
        });

        // hide drop down nav after clicking on a link  
        query(".navbar-collapse a").on("click", function (e) {
            hideDropdownNav(e);
        });

        // change the basemap  
        query("#basemapDropdown a").on("click", function (e) {
            var basemapName = domAttr.get(e.target, "data-name");
            if (basemapName && app.map) {
                app.map.setBasemap(basemapName);
            }
        });

        // toggle the sidebar  
        query("#sidebarToggleButton").on("click", function (e) {
            // make sure sidebar is same height as the map  
            if (app.map.height) {
                domStyle.set(app.sidebar, "height", app.map.height + "px");
            }
            domClass.toggle(window.document.body, "sidebar-open");
            hideDropdownNav(e);
        });

        // submit or cancel request and hide modal  
        query("#attributesModal .btn").on("click", function (e) {
            var target = e.target;
            if (target.innerText === "Submit") {
                submitIncidentReport();
            }
            app.attributesModal.modal("hide");
        });


        
        // submit or cancel request and hide modal  
        //query("#feedbackModal .btn").on("click", function (e) { // e is defined but never used.
        //    // NOTE: this is not implemented in sample app  
        //    query("#feedbackModal").modal("hide");
        //});

        // clear current edit session globals  
        app.attributesModal.on("hidden.bs.modal", stopCaptureRequest);
    };

    // finally, start up the app!  
    initAttributeForm();
    initMap();
    initEvents();

    return app;
});