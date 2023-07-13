///////////////////////////////////////////////////////////////////////////////////////////////////////
// THIS SECTION MIMICS THE UI                                                                        //                                                              //  
///////////////////////////////////////////////////////////////////////////////////////////////////////

// select date
var start_date = '2001-01-01';
var end_date = '2001-06-01';

// Select Model
var model = 'disalexi';
var image_coll = ee.ImageCollection('projects/openet/disalexi/conus/gridmet/monthly/provisional')
  .filterDate(start_date, end_date);

// get state boundary of Oregon
var states = ee.FeatureCollection('TIGER/2018/States');
var oregon = states.filter(ee.Filter.eq('GEOID', '41'));

//////////////////////////////////////////////////////////////////////////////////////////////////////
// END OF UI                                                                                        //                                                                     
//////////////////////////////////////////////////////////////////////////////////////////////////////


// remove all bands but et
image_coll = image_coll.select(['et']);

// hacky list manipulation
var to_list = image_coll.toList(image_coll.size());
var size_of_sub_list = to_list.size().divide(2);

// EPSG:32610 T10
var image_coll_list = to_list.splice(size_of_sub_list, size_of_sub_list);

// EPSG:32611 T11
var eleven_t_list = to_list.splice(0, size_of_sub_list);

// combine the two sepearte lists into one list of list pairs
var combinations = image_coll_list.zip(eleven_t_list);

// Why can't I reproject 10T --> 11T?
// ELEVEN_T = ee.Image(ELEVEN_T).reproject({crs : 'EPSG:32610'});

print(combinations);

function mosaic_two_images(lst){

  lst = ee.List(lst);
  
  var my_id = ee.Image(lst.get(0)).id().slice(4);
  
  // crs: EPSG:4326 (not real?)
  var new_mosaic = ee.Image(ee.ImageCollection([lst.get(0), lst.get(1)]).mosaic());
  
   new_mosaic = new_mosaic.set("system:index",my_id);
  
  return new_mosaic;
  
}


var mosaic_images = combinations.map(mosaic_two_images);


function export_tif(img){
  
  // clip so that idahoe and washington datat is left out
  img = ee.Image(img);
  img = img.clip(oregon);

  // convert all bands to unsigned int16. If types are not consistent than an error is thrown. 
  //img = img.toUint16();
  
  // Use RNG to create image name. This solves the problemwith duplicate names
  var rng_number = Math.floor(Math.random() * 1000000000);

  // Create file path
  var path = 'oregon/' + model + '_' + start_date + '_' + end_date + '/' + img.id().getInfo();

  // Export to Google bucket as a .tif file. (GeoTIFF)
  Export.image.toCloudStorage({
  image: img,
  //description: path,
  bucket: 'openet_temp',
  fileNamePrefix: path,
  //crs: 'EPSG:4326',
  //crsTransform: [30, 0, 239985, 0, -30, 5299995],
  region: oregon
  
  });
}

// For loop to export each image in the list
for(var i = 0; i < mosaic_images.length().getInfo(); ++i){
 
  export_tif(mosaic_images.get(i));

}


