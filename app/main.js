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
  "esri/tasks/QueryTask",

  "esri/geometry/Extent",
  "esri/layers/LayerInfo",
  "esri/layers/ArcGISDynamicMapServiceLayer",
  "esri/layers/ArcGISTiledMapServiceLayer",
  "esri/request",

  "bootstrap-map-js/js/bootstrapmap",

  "dijit/form/ValidationTextBox",
  "dijit/form/CheckBox",
  
  "dojo/on",
  "dojo/parser",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/string",

  "dojo-bootstrap/Collapse",
  "dojo-bootstrap/Dropdown",
  "dojo-bootstrap/Modal",
  "dojo-bootstrap/Alert",

  
  "dojo/domReady!"
], function (
  query, dom, domClass, domStyle, domAttr, validate, check,
  esriConfig, FeatureLayer, InfoTemplate, Graphic, Geocoder, LocateButton, Legend, GeometryService, esriQuery, QueryTask,
  Extent, LayerInfo, ArcGISDynamicMapServiceLayer, ArcGISTiledMapServiceLayer, esriRequest,
  BootstrapMap, ValidationTextBox, CheckBox, on, parser, lang, array, string
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
    //esri.config.defaults.io.corsEnabledServers.push("maps.decaturil.gov");

    // Proxy Definition End  

    
    // declare geometry service  
    esriConfig.defaults.geometryService = new GeometryService("http://maps.decaturil.gov/arcgis/rest/services/Utilities/Geometry/GeometryServer");
    

    //Map Options
    var initialExtent = new Extent({
        "xmin": 777229.03,
        "ymin": 1133467.92,
        "xmax": 848340.14,
        "ymax": 1185634.58,
        "spatialReference": {
            "wkid": 3435
        }
    });


    
    var restEndPoint = "http://maps.decaturil.gov/arcgis/rest/services/test/StreetSignTest/FeatureServer/";
   
    // app configuration    
    var config = {  
        mapOptions: {  
            showAttribution: false,  
            sliderStyle: "small",  
            extent: initialExtent,  
            logo: false,  
            sliderPosition: "bottom-right"  
        },    
        signLayerUrl: undefined,  
        supportLayerUrl: undefined  
    };  
  

    // Get the id of a layer  
    var requestHandle = esriRequest({  
        url: "http://maps.decaturil.gov/arcgis/rest/services/test/StreetSignTest/FeatureServer/",  
        content: { f: 'json' },  
        handleAs: "json"  
    });  
  
    // Identify the number of layer by layer name and then assign the layer number
    requestHandle.then(function (lyrJSON, io) {  
        for (var i = 0; i < lyrJSON.layers.length; i++) {  
            if (lyrJSON.layers[i].name == "Support") {    
                config.supportLayerUrl = restEndPoint + lyrJSON.layers[i].id;  
            }  
            if (lyrJSON.layers[i].name == "Sign") {  
                config.signLayerUrl = restEndPoint + lyrJSON.layers[i].id;  
            }  
        }  
        initMap();  
    })  
   

    // app globals  
    var app = {};
    var signSupportId;
    var streetSupportId;

    // Begin Populate Select - this will allow for the population of dropdown lists based on domain in the feature service
    function populateSelect(x, y, layer) {
        //get the domain value   
        var domain;
        switch (layer) {
            case 'support':
                domain = app.supportLayer.getDomain(x);
                break;
            case 'sign':
                domain = app.signLayer.getDomain(x);
                break;
        }

        //get the html select by ID    
        var select = document.getElementById(y);

        //clear the current options in select    
        for (var option in select) {
            select.remove(option);
        }

        var opt = document.createElement('option');
        opt.innerHTML = "";
        select.appendChild(opt);
        //loop through the domain value to fill the drop down    
        for (var i = 0; i < domain.codedValues.length; i++) {
            console.log(domain.codedValues[i].name);
            ; var opt = document.createElement('option');
            opt.innerHTML = domain.codedValues[i].name;
            opt.value = domain.codedValues[i].name;
            select.appendChild(opt);
        }

    }

    // End Populate Select
   
   
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

    /* Toggle layer visibility */
    on(dom.byId("lyrSigns"), "change", updateLayerVisibility);
    on(dom.byId("lyrSupports"), "change", updateLayerVisibility);
    

    /* Toggle checkboxes */
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

        /* Evaluate if any web services are not running */
        app.map.on("layer-add-result", function (evt) {
            //console.log(evt);
           
            var evalLayers = evt.layer.valueOf();

            if (evalLayers._div == null) {
                
                /* Page Redirect */
                window.location.assign("http://www.w3schools.com")
            }
            
        });


        var tiled = new ArcGISTiledMapServiceLayer("http://maps.decaturil.gov/arcgis/rest/services/Aerial_2014_Tiled/MapServer");
        app.map.addLayer(tiled);

        // add operational layer  
        var operationalLayer = new ArcGISDynamicMapServiceLayer("http://maps.decaturil.gov/arcgis/rest/services/Public/InternetVector/MapServer", {
            "opacity": 0.5
        });
        app.map.addLayer(operationalLayer);

       

        /* Configure sign layer */
        app.signLayer = new FeatureLayer(config.signLayerUrl, {
            mode: FeatureLayer.MODE_ONEDEMAND,
            outFields: ["*"]
        });

        /* Add sign Layer */
        app.map.addLayer(app.signLayer);


        /* Configure support layer */
        app.supportLayer = new FeatureLayer(config.supportLayerUrl, {
            mode: FeatureLayer.MODE_ONEDEMAND,
            //infoTemplate: new InfoTemplate(config.infoTemplate),
            outFields: ["*"]
        });

        /* Add support layer */
        app.map.addLayer(app.supportLayer);
       
        

        /* Update Support Layer Begin */
        app.supportLayer.on("click", function (evt) {


            /* Get support information on click */
            var objectId, type, address, size, material, base, rating, dateInv, inspector, comments, addrCode;

            // declare rest endpoint values
            objectId = evt.graphic.attributes.OBJECTID;
            streetSupportId = evt.graphic.attributes.SUPPORTID;
            type = evt.graphic.attributes.TYPE;
            address = evt.graphic.attributes.ADDRESS;
            size = evt.graphic.attributes.SIZE_;
            material = evt.graphic.attributes.MATERIAL;
            base = evt.graphic.attributes.BASE;
            rating = evt.graphic.attributes.RATING;
            dateInv = evt.graphic.attributes.DATEINV;
            inspector = evt.graphic.attributes.INSPECTOR;
            comments = evt.graphic.attributes.COMMENTS;
            addrCode = evt.graphic.attributes.ADDRCODE;

            

            // Clear form of values before connecting current values
            document.getElementById("supportForm").reset();

            /* DOMAIN, ELEMENT, LAYER */
            /* Enter your domain item and then the element to populate */
            populateSelect("TYPE", "TYPE", "support");
            populateSelect("SIZE_", "SIZE_", "support");
            populateSelect("MATERIAL", "MATERIAL", "support");
            populateSelect("BASE", "BASE", "support");
            populateSelect("RATING", "RATING", "support");

            /* Populate form with data */
            document.getElementById("OBJECTID").value = objectId;
            document.getElementById("ADDRESS").value = address;
            document.getElementById("SUPPORTID").value = streetSupportId;
            document.getElementById("TYPE").value = type;
            document.getElementById("SIZE_").value = size;
            document.getElementById("MATERIAL").value = material;
            document.getElementById("BASE").value = base;
            document.getElementById("RATING").value = rating;
            document.getElementById("DATEINV").value = dateInv;
            document.getElementById("INSPECTOR").value = inspector;
            document.getElementById("COMMENTS").value = comments;
            document.getElementById("ADDRCODE").value = addrCode;
           
            // determine if sign layer is visible
            console.log(app.signLayer.visible);
            
            if (app.signLayer.visible == true) {
                console.log("Signs are here!")
                // gets the streetSupportId which will be the parameter used in the query to count the number of signs
                console.log(streetSupportId);

                // url the query task is to be performed on
                var query = new esriQuery();
                var queryTask = new QueryTask(config.signLayerUrl);


                // count related records
                query.where = "SUPPORTID = " + streetSupportId;

                // display number of related records in console
                queryTask.executeForCount(query, function (count) {
                    console.log(count);
                    if (count >= 1) {
                        document.getElementById("btnRelatedSigns").style.visibility = "visible";
                    } else {
                        document.getElementById("btnRelatedSigns").style.visibility = "hidden";
                    }

                })
            }

            // Show supports form for updating
            document.getElementById("btnSupportUpdate").style.visibility = "visible";
            app.attributesModal.modal("show");

            ii = -1;


           
        });
        /* Update Support Layer End */



        /*-------------------------------------------------------------------*/
        /* START HERE                                                        */
        /* Add all value to dropdowns and then add related records */
        /* Display Related Signs */
        on(dom.byId("btnRelatedSigns"), "click", function () {

            signSupportId = dom.byId("SUPPORTID").value;

            // Hide the supports form
            app.attributesModal.modal("hide");
            // Clear form of values before connecting current values
            document.getElementById("signForm").reset();

            /* DOMAIN, ELEMENT, LAYER */
            /* Enter your domain item and then the element to populate */
            populateSelect("MUTCD", "sign_MUTCD", "sign");
            populateSelect("VISIBILITY", "sign_VISIBILITY", "sign");
            populateSelect("CONDITION_", "sign_CONDITION_", "sign");
            populateSelect("COLOR1", "sign_COLOR1", "sign");
            populateSelect("DELINEATOR", "sign_DELINEATOR", "sign");
            populateSelect("ILLUM", "sign_ILLUM", "sign");
            populateSelect("BACKING", "sign_BACKING", "sign");
            populateSelect("ATTACHTYPE", "sign_ATTACHTYPE", "sign");
            populateSelect("ATTACHLOC", "sign_ATTACHLOC", "sign");
            populateSelect("SITEOBS", "sign_SITEOBS", "sign");
            populateSelect("SIGNSHAPE", "sign_SIGNSHAPE", "sign");
            populateSelect("COLOR2", "sign_COLOR2", "sign");

            document.getElementById("sign_SUPPORTID").value = signSupportId;
            document.getElementById("btnSignUpdate").style.visibility = "visible";
            document.getElementById("btnSignPrevious").style.visibility = "visible";
            document.getElementById("btnSignNext").style.visibility = "visible";
           

            app.attributesSignModal.modal("show");
            

            
        })
        

        // Cycle through sign information with the previous button
        // Changed name to correct button name
        on(dom.byId("btnSignPrevious"), "click", function () {
            var query = new esriQuery();
            var queryTask = new QueryTask(config.signLayerUrl);
            query.returnGeometry = false;
            query.outFields = ["*"];
            query.where = "SUPPORTID = " + dom.byId("sign_SUPPORTID").value;
            queryTask.execute(query, function (results) {
                ii--;
                var resultItems = [];
                var resultCount = results.features.length;
                if (ii > -1) {
                    if (dom.byId("sign_SIGNID").value == results.features[ii].attributes.SUPPORTID) {
                        ii--;
                    }
                    var featureAttributes = results.features[ii].attributes;
                    for (var attr in featureAttributes) {
                        document.getElementById("sign_" + attr).value = featureAttributes[attr];
                    }
                } else {
                    alert("This is where you will get the support information");
                }
            })
        });



        var ii;
        
        // Cycle through sign information with the next button
         on(dom.byId("btnSignNext"), "click", function () {
            var query = new esriQuery();
            var queryTask = new QueryTask(config.signLayerUrl);
            query.returnGeometry = false;
            query.outFields = ["*"];
            query.where = "SUPPORTID = " + dom.byId("sign_SUPPORTID").value;
            queryTask.execute(query, function (results) {
                ii++;
                var resultItems = [];
                var resultCount = results.features.length;
                if (ii < resultCount) {
                    if (dom.byId("sign_SIGNID").value == results.features[ii].attributes.SUPPORTID) {
                        ii++;
                    }
                    var featureAttributes = results.features[ii].attributes;
                    for (var attr in featureAttributes) {
                       
                        document.getElementById("sign_" + attr).value = featureAttributes[attr];
                    }
                } else {
                    alert("This is where you will get the support information");
                }
            })
        });


       
       

        /* Update Sign Layer Begin */
        app.signLayer.on("click", function (evt) {

            

            var installed, signId, facing, visibility, condition, text, color1, delineator, illum, offset;
            var mountht, backing, width, height, txtSize, numSize, comments, twoSided, attachType, attachNum, attachLoc, siteObs, signShape, color2, mutcd;
            var signObjectId;

            signObjectId = evt.graphic.attributes.OBJECTID;
            mutcd = evt.graphic.attributes.MUTCD;
            installed = evt.graphic.attributes.INSTALLED;
            signId = evt.graphic.attributes.SIGNID;
            facing = evt.graphic.attributes.FACING;
            visibility = evt.graphic.attributes.VISIBILITY;
            condition = evt.graphic.attributes.CONDITION_;
            signSupportId = evt.graphic.attributes.SUPPORTID;
            text = evt.graphic.attributes.TEXT;
            color1 = evt.graphic.attributes.COLOR1;
            delineator = evt.graphic.attributes.DELINEATOR;
            illum = evt.graphic.attributes.ILLUM;
            offset = evt.graphic.attributes.OFFSET;
            mountht = evt.graphic.attributes.MOUNTHT;
            backing = evt.graphic.attributes.BACKING;
            width = evt.graphic.attributes.WIDTH;
            height = evt.graphic.attributes.HEIGHT;
            txtSize = evt.graphic.attributes.TXTSIZE;
            numSize = evt.graphic.attributes.NUMSIZE;
            comments = evt.graphic.attributes.COMMENTS;
            twoSided = evt.graphic.attributes.TWOSIDED;
            attachType = evt.graphic.attributes.ATTACHTYPE;
            attachNum = evt.graphic.attributes.ATTACHNUM;
            attachLoc = evt.graphic.attributes.ATTACHLOC;
            siteObs = evt.graphic.attributes.SITEOBS;
            signShape = evt.graphic.attributes.SIGNSHAPE;
            color2 = evt.graphic.attributes.COLOR2;
            


            // Clear form of values before connecting current values
            document.getElementById("signForm").reset();

            /* DOMAIN, ELEMENT, LAYER */
            /* Enter your domain item and then the element to populate */
            populateSelect("MUTCD", "sign_MUTCD", "sign");
            populateSelect("VISIBILITY", "sign_VISIBILITY", "sign");
            populateSelect("CONDITION_", "sign_CONDITION_", "sign");
            populateSelect("COLOR1", "sign_COLOR1", "sign");
            populateSelect("DELINEATOR", "sign_DELINEATOR", "sign");
            populateSelect("ILLUM", "sign_ILLUM", "sign");
            populateSelect("BACKING", "sign_BACKING", "sign");
            populateSelect("ATTACHTYPE", "sign_ATTACHTYPE", "sign");
            populateSelect("ATTACHLOC", "sign_ATTACHLOC", "sign");
            populateSelect("SITEOBS", "sign_SITEOBS", "sign");
            populateSelect("SIGNSHAPE", "sign_SIGNSHAPE", "sign");
            populateSelect("COLOR2", "sign_COLOR2", "sign");
            


            /* Populate form with data */
            
            document.getElementById("sign_OBJECTID").value = signObjectId;
            document.getElementById("sign_MUTCD").value = mutcd;
            document.getElementById("sign_INSTALLED").value = installed;
            document.getElementById("sign_SIGNID").value = signId;
            document.getElementById("sign_FACING").value = facing;
            document.getElementById("sign_VISIBILITY").value = visibility;
            document.getElementById("sign_CONDITION_").value = condition;
            document.getElementById("sign_SUPPORTID").value = signSupportId;
            document.getElementById("sign_TEXT").value = text;
            document.getElementById("sign_COLOR1").value = color1;
            document.getElementById("sign_DELINEATOR").value = delineator;
            document.getElementById("sign_ILLUM").value = illum;
            document.getElementById("sign_OFFSET").value = offset;
            document.getElementById("sign_MOUNTHT").value = mountht;
            document.getElementById("sign_BACKING").value = backing;
            document.getElementById("sign_WIDTH").value = width;
            document.getElementById("sign_HEIGHT").value = height;
            document.getElementById("sign_TXTSIZE").value = txtSize;
            document.getElementById("sign_NUMSIZE").value = numSize;
            document.getElementById("sign_COMMENTS").value = comments;
            document.getElementById("sign_TWOSIDED").value = twoSided;
            document.getElementById("sign_ATTACHTYPE").value = attachType;
            document.getElementById("sign_ATTACHNUM").value = attachNum;
            document.getElementById("sign_ATTACHLOC").value = attachLoc;
            document.getElementById("sign_SITEOBS").value = siteObs;
            document.getElementById("sign_SIGNSHAPE").value = signShape;
            document.getElementById("sign_COLOR2").value = color2;


            if (app.supportLayer.visible == true) {
                document.getElementById("btnSignPrevious").style.visibility = "visible";
                document.getElementById("btnSignNext").style.visibility = "visible";
            } else {
                // url the query task is to be performed on
                var query = new esriQuery();
                var queryTask = new QueryTask(config.signLayerUrl);


                // count related records
                query.where = "SUPPORTID = " + signSupportId;

                // display number of related records in console
                queryTask.executeForCount(query, function (count) {
                    console.log(count);
                    if (count > 1) {
                        document.getElementById("btnSignPrevious").style.visibility = "visible";
                        document.getElementById("btnSignNext").style.visibility = "visible";
                    } else {
                        document.getElementById("btnSignPrevious").style.visibility = "hidden";
                        document.getElementById("btnSignNext").style.visibility = "hidden";
                    }

                })
            
            }


            

          
            document.getElementById("btnSignUpdate").style.visibility = "visible";
            // Show signs form for updating
            app.attributesSignModal.modal("show");

            ii = -1;


        });
        /* Update Sign Layer End */




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
            
            /* Show signs form */
            if (severity === "0") {
                
                document.getElementById("signForm").reset();

                /* DOMAIN, ELEMENT, LAYER */
                /* Enter your domain item and then the element to populate */
                populateSelect("BACKING", "sign_BACKING", "sign");
                populateSelect("VISIBILITY", "sign_VISIBILITY", "sign");
                populateSelect("CONDITION_", "sign_CONDITION_", "sign");
                populateSelect("COLOR1", "sign_COLOR1", "sign");
                populateSelect("DELINEATOR", "sign_DELINEATOR", "sign");
                populateSelect("ILLUM", "sign_ILLUM", "sign");
                populateSelect("ATTACHTYPE", "sign_ATTACHTYPE", "sign");
                populateSelect("ATTACHLOC", "sign_ATTACHLOC", "sign");
                populateSelect("SITEOBS", "sign_SITEOBS", "sign");
                populateSelect("SIGNSHAPE", "sign_SIGNSHAPE", "sign");
                populateSelect("COLOR2", "sign_COLOR2", "sign");
                populateSelect("MUTCD", "sign_MUTCD", "sign");

                document.getElementById("btnSignSubmit").style.visibility = "visible";
                document.getElementById("btnSignUpdate").style.visibility = "hidden";
                app.attributesSignModal.modal("show");
                

                

                /* Show supports form */
            } else if (severity === "1") {

                document.getElementById("supportForm").reset();
                /* Enter your domain item and then the element to populate */
                populateSelect("TYPE", "TYPE", "support");
                populateSelect("SIZE_", "SIZE_", "support");
                populateSelect("MATERIAL", "MATERIAL", "support");
                populateSelect("BASE", "BASE", "support");
                populateSelect("RATING", "RATING", "support");

                document.getElementById("btnSupportSubmit").style.visibility = "visible";
                document.getElementById("btnSupportUpdate").style.visibility = "hidden";
                document.getElementById("btnRelatedSigns").style.visibility = "hidden";
                app.attributesModal.modal("show");

            }

           
        });
    };

    var stopCaptureRequest = function () {
          app.currentGeometry = null;
    };
    

    // get attributes from form and submit  
    var addSupports = function () {
        
        //alert(domClass.contains("attributesModal", "in"));

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
        if ((attributes.SUPPORTID === undefined) || (attributes.SUPPORTID === "")) {
            attributes.SUPPORTID = null;
        }
        if ((attributes.DATEINV === undefined) || (attributes.DATEINV === "")) {
            attributes.DATEINV = null;
        }
        if ((attributes.ADDRCODE === undefined) || (attributes.ADDRCODE === "")) {
            attributes.ADDRCODE = null;
        }        

        
        
        //graphic.setAttributes(attributes);
        stopCaptureRequest();
        
       
        //console.log(attributes);  
        app.supportLayer.applyEdits([graphic], null, null).then(function (response) {
            console.log(response);
            app.supportLayer.refresh();
            
        });
        
    };


    // get attributes from form and submit  
    var updateSupports = function () {


        //alert(domClass.contains("attributesModal", "in"));

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
        if ((attributes.SUPPORTID === undefined) || (attributes.SUPPORTID === "")) {
            attributes.SUPPORTID = null;
        }
        if ((attributes.DATEINV === undefined) || (attributes.DATEINV === "")) {
            attributes.DATEINV = null;
        }
        if ((attributes.ADDRCODE === undefined) || (attributes.ADDRCODE === "")) {
            attributes.ADDRCODE = null;
        }

        attributes.OBJECTID = parseInt(attributes.OBJECTID, 10);
        attributes.SUPPORTID = parseInt(attributes.SUPPORTID, 10);
        attributes.addrCode = parseInt(attributes.ADDRCODE, 10);

        graphic.setAttributes(attributes);
        stopCaptureRequest();


        console.log(attributes);

        app.supportLayer.applyEdits(null, [graphic], null).then(function (response) {
            console.log(response);
            
        });
        app.supportLayer.refresh();
        graphic.refresh();
        //location.reload();
        
    };


    // get sign attributes from form and submit
    var addSigns = function () {

       // alert(domClass.contains("attributesSignModal", "in"));

        var attributes = {
            // TODO: not sure if this is needed  
            //requestreceived: null
        };
        var currentDate = new Date(); // current date is defined but never used.
        var graphic;


        graphic = new Graphic(app.currentGeometry);

        query("#attributesSignModal input, #attributesSignModal select, #attributesSignModal textarea").forEach(function(formInput) {
            attributes[formInput.name] = formInput.value;
        });

        // Form validation - ensures that the values for the data are here if left blank
        if ((attributes.sign_INSTALLED === undefined)|| (attributes.sign_INSTALLED === "")) {
            attributes.sign_INSTALLED = null;
        }
        if ((attributes.sign_SIGNID === undefined) || (attributes.sign_SIGNID === "")) {
            attributes.sign_SIGNID = null;
        }
        if ((attributes.sign_SUPPORTID === undefined) || (attributes.sign_SUPPORTID === "")) {
            attributes.signSUPPORTID = null;
        }


        attributes.supportId = attributes.sign_SUPPORID;
        delete attributes.sign_SUPPORTID;

        graphic.setAttributes(attributes);
        stopCaptureRequest();

        console.log(attributes);  
        app.signLayer.applyEdits([graphic], null, null).then(function (response) {
            console.log(response);
            app.signLayer.refresh();
            
        });


    };


    // get sign attributes from form and submit
    var updateSigns = function () {

        // alert(domClass.contains("attributesSignModal", "in"));

        var attributes = {
            // TODO: not sure if this is needed  
            //requestreceived: null
        };
        var currentDate = new Date(); // current date is defined but never used.
        var graphic;


        graphic = new Graphic(app.currentGeometry);

        

        query("#attributesSignModal input, #attributesSignModal select, #attributesSignModal textarea").forEach(function (formInput) {
            attributes[formInput.name] = formInput.value;
        });

        // Form validation - ensures that the values for the data are here if left blank
        if ((attributes.sign_INSTALLED === undefined) || (attributes.sign_INSTALLED === "")) {
            attributes.sign_INSTALLED = null;
        }
        if ((attributes.sign_SIGNID === undefined) || (attributes.sign_SIGNID === "")) {
            attributes.sign_SIGNID = null;
        }
        if ((attributes.sign_SUPPORTID === undefined) || (attributes.sign_SUPPORTID === "")) {
            attributes.sign_SUPPORTID = null;
        }

        
        // Preparing the data for processing to the server
        attributes.ObjectID = parseInt(attributes.sign_OBJECTID, 10);
        delete attributes.signOBJECTID;

        attributes.supportId = parseInt(attributes.sign_SUPPORTID, 10);
        delete attributes.sign_SUPPORTID;

        attributes.sign_COMMENTS = attributes.sign_COMMENTS;
        delete attributes.sign_COMMENTS;



        
        graphic.setAttributes(attributes);

        stopCaptureRequest();

        
        console.log(attributes);
       
        app.signLayer.applyEdits(null, [graphic], null).then(function (response) {
            console.log(response);
            
        });
       
        // refreshing the layer and graphics to update the points for the onclick method
        app.signLayer.refresh();
        graphic.refresh();
        //location.reload();
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

        // submit or cancel request and hide support modal  
        query("#attributesModal .btn").on("click", function (e) {
            var target = e.target;
            if (target.innerText === "Submit") {
                addSupports();
            }
            
            app.attributesModal.modal("hide");
            document.getElementById("btnSupportSubmit").style.visibility = "hidden";
        });


        // submit or cancel request and hide support modal  
        query("#attributesModal .btn").on("click", function (e) {
            var target = e.target;
            if (target.innerText === "Update") {
                updateSupports();
                app.attributesModal.modal("hide");
                document.getElementById("btnSupportUpdate").style.visibility = "hidden";
            } else if (target.innerText === "Cancel") {
                app.attributesModal.modal("hide");
                document.getElementById("btnSupportUpdate").style.visibility = "hidden";
            }
            
        });


        // submit or cancel request and hide sign modal
        query("#attributesSignModal .btn").on("click", function(e) {
            var target = e.target;
            if (target.innerText === "Submit") {
                addSigns();
            }
            app.attributesSignModal.modal("hide");
            document.getElementById("btnSignSubmit").style.visibility = "hidden";
        });


        // submit or cancel request and hide sign modal
        query("#attributesSignModal .btn").on("click", function (e) {
            var target = e.target;
            if (target.innerText === "Update") {
                updateSigns();
            }
            app.attributesSignModal.modal("hide");
            document.getElementById("btnSignUpdate").style.visibility = "hidden";
        });

        // submit or cancel request and hide modal  
        query("#feedbackModal .btn").on("click", function (e) { // e is defined but never used.
            // NOTE: this is not implemented in sample app  
            query("#feedbackModal").modal("hide");
        });

        // clear current edit session globals  
        app.attributesModal.on("hidden.bs.modal", stopCaptureRequest);
    };

    // finally, start up the app!  
    initAttributeForm();
    //initMap();
    initEvents();

    return app;
});