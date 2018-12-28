/** Rating class
* Search automation for ratings of different movie websites
* You can either use the rating Google provides on their results or write your own scrapper for a rating from any website and "hook" it to this rating
**/
class Rating {

  constructor(options) {
    //Required; Full name of the website
    this._site = options.site;

    //Required; Abbrivation of the websites name
    this._abbreviation = options.abbreviation;

    //(Only for the type Info) Short description of the website
    this._description = options.description;

    //Required; URL of the website; Used for the search
    this._url = options.url;

    //[Used by standard Google rating scrapper] (Default) Range of the Rating
    this._range = options.range;

    //[Used by standard Google rating scrapper] Required; ID of the Div-container where the rating will be added
    this._elementId = options.elementId;

    //[Used by standard Google rating scrapper] Required; ID of the ratings Div-container
    this._containerId = options.containerId;
  }

  set site(value) { this._site = value || ""; }
  get site() { return this._site; }

  set abbreviation(value) { this._abbreviation = value || ""; }
  get abbreviation() { return this._abbreviation; }

  set description(value) { this._description = value || ""; }
  get description() { return this._description; }

  set url(value) { this._url = value || ""; }
  get url() { return this._url; }

  set range(value) { this._range = value || "10"; }
  get range() { return this._range; }

  set elementId(value) { this._elementId = value || ""; }
  get elementId() { return this._elementId; }

  set containerId(value) { this._containerId = value || ""; }
  get containerId() { return this._containerId; }

  static movieAliases() {
    return movieData[0];
  }

  static movieYear() {
    return movieData[1];
  }

  static correctness() {
    return { PERFECT: 0, GOOD: 1, OKAY: 2, BAD: 3, POOR: 4 };
  }


  var googleRequest="";
  var googleRequestModifier = function(url) {return url;}; 	//Modify Googles request URL
  var ratingRequest="";
  var ratingRequestModifier = function(url) {return url;};	//Modify the request URL of the rating website
  var ratingLinkModifier = function(url) {return url;}; // Modify the Link to the rating website
  var ratingSourceTypes = {EXTERN: 0, GOOGLE: 1, INFO:2};		//Type of the rating; EXTERN for own rating scrapper, GOOGLE for standard Google scrapper, INFO for a information website without rating
  var ratingSourceType = ratingSourceTypes.EXTERN;		//Current type of the rating
  var numberOfResultsIncluded = 1;	//Number of Google results that should be included in a search
  var excludeUnplausibleYear = false;	//Should a result be excluded if the movie years aren't matching?
  var googleHookFunction = null; //Hooked function; Will be called after a successfull google request
  var responseSiteHookFunction = null; //Hooked function; Will be called after a successfull rating website request
  var scrapperFunction = null;	//Scrapper function
  var estCorrectness = Rating.correctness.LOW;	//Estimated correctness of a rating result
  var blacklistedStrings = []; //Backlist of regular expressions, that will be deleted from char sequences like titles and infos

  var callback;
  var SEARCH_GOOGLE_RESULT_INFO = false;	//Search Googles infos to a result for matches too
  var LINK_WEBSITES = true;	//Link the websites
  var LET_ME_GOOGLE_THAT = true;	//Link the Google request if a search is failing
  var REQ_TIMEOUT = 10000;
  var REQ_SYNCHRONOUS = false;

  this.ratingSite = function(string) {ratingSite = string; return this;};
  this.ratingSiteAbbr = function(string) {ratingSiteAbbr = string; return this;};
  this.description = function(string) {description = string; return this;};
  this.ratingRange = function(string) {ratingRange = string; return this;};
  this.ratingId = function(string) {ratingId = string; return this;};
  this.ratingDivId = function(string) {ratingDivId = string; return this;};
  this.websiteURL = function(string) {websiteURL = string; return this;};
  this.googleRequestModifier = function(func) {googleRequestModifier = func; return this;};
  this.ratingRequestModifier = function(func) {ratingRequestModifier = func; return this;};
  this.ratingLinkModifier = function(func) {ratingLinkModifier = func; return this;};
  this.externRating = function() {ratingSourceType = ratingSourceTypes.EXTERN; return this;};
  this.googleRating = function() {ratingSourceType = ratingSourceTypes.GOOGLE; return this;};
  this.info = function() {ratingSourceType = ratingSourceTypes.INFO; return this;};
  this.numberOfResultsIncluded = function(number) {numberOfResultsIncluded = number; return this;};
  this.excludeUnplausibleYear = function(boolean) {excludeUnplausibleYear = boolean; return this;};
  this.googleHookFunction = function(func) {googleHookFunction = func; return this;};
  this.responseSiteHookFunction = function(func) {responseSiteHookFunction = func; return this;};
  this.scrapperFunction = function(func) {scrapperFunction = func; return this;};
  this.blacklist = function(regex) {blacklistedStrings.push(regex); return this;};

  this.getRating = function() {
  /* Kick off the search */
          googleRequest = "https://www.google.de/search?q=site:"+websiteURL+"+"+Rating.movieAliases[0].replace(/ /g,"+")+((Rating.movieYear !== '') ? "+"+Rating.movieYear : '');
          googleRequest = googleRequestModifier(googleRequest);
          googleRequest = Refinery.encode(googleRequest);
          if(DEBUG_MODE) {
                  log("Google request: "+googleRequest);
          }
          callback = handleGoogleResponse; // Setting a callback function; Will be called in an anonymous function in sendRequest
          sendRequest(googleRequest);
  };

  function handleGoogleResponse(request, response) {
  /* Handler for Google response */
          if(DEBUG_MODE) {
                  log("Google request successfull.");
          }

          var googleResponse = parseToHTMLElement(response.responseText);
          var googleResults = googleResponse.getElementsByClassName("g", 5);
          var bestResult = getBestGoogleResult(googleResults);

          if(bestResult !== null) {
                  if(DEBUG_MODE) {
                          log("Plausible google result found.");
                  }
                  ratingRequest = bestResult[0];
                  ratingRequest = ratingRequestModifier(ratingRequest);

                  if(ratingSourceType == ratingSourceTypes.GOOGLE) {
                          var rating = getRatingByGoogle(bestResult[1]);
                          if(LINK_WEBSITES) {
                                  MPExtension.addRatingToContainer(ratingId, MPRatingFactory.wrapRatingWithLink(rating, ratingRequest));
                          } else {
                                  MPExtension.addRatingToContainer(ratingId, rating);
                          }
                  } else if(ratingSourceType == ratingSourceTypes.INFO) {
                          var info = MPRatingFactory.buildInfo(ratingSite,description, estCorrectness, ratingDivId);
                          MPExtension.addRatingToContainer(ratingId, MPRatingFactory.wrapRatingWithLink(info, ratingRequest));
                  } else {	//Type EXTERN
                          callback = handleRatingSiteResponse;
                          if(DEBUG_MODE) {
                                  log("Rating site request: "+ratingRequest);
                          }
                          sendRequest(ratingRequest);
                  }
          } else {
                  if(DEBUG_MODE) {
                          log("No plausible google result.");
                  }
                  if(googleHookFunction !== null) {
                          googleHookFunction();
                  }
                  if(LET_ME_GOOGLE_THAT) {
                          MPExtension.addRatingToContainer(ratingId, MPRatingFactory.wrapRatingWithLink(MPRatingFactory.getNotFoundRating(ratingSite, ratingRange, ratingDivId), request));
                  } else {
                          MPExtension.addRatingToContainer(ratingId, MPRatingFactory.getNotFoundRating(ratingSite, ratingRange, ratingDivId));
                  }
          }
  }

  function handleRatingSiteResponse (request, response) {
  /* Handler for rating site response */
          if(DEBUG_MODE) {
                  log("Rating site request successfull.");
          }
          var ratingSiteResponse = parseToHTMLElement(response.responseText)
          if(responseSiteHookFunction !== null) {
                  responseSiteHookFunction(ratingSiteResponse);
          }
          if(scrapperFunction !== null) {
                  var rating = scrapperFunction(ratingSiteResponse, estCorrectness);
                  var ratingRequest = ratingLinkModifier(request);
                  if(LINK_WEBSITES) {
                          MPExtension.addRatingToContainer(ratingId, MPRatingFactory.wrapRatingWithLink(rating, ratingRequest));
                  } else {
                          MPExtension.addRatingToContainer(ratingId, rating);
                  }
          } else {
                  log("No scrapper function defined.");
          }
  }

 function getBestGoogleResult(googleResults) {
  /* Result-Scrapper for Google
  * Checks the results for plausibility
  *
  * return   Array: Link zum Ergebnis und HTML des Google-Ergebnisses oder null
  */
          var bestCorrectnessResult = 0;
          var bestSpamResult = 0;
          var bestResultIndex = 0;
          var foundCounter = 0;
          var correctnessIndicator = 0;
          var spamIndicator = 0;
          var googleResultURLs = [];
          var movieAliases = Rating.movieAliases;

          if(DEBUG_MODE && VERBOSE) {
                  log(googleResults.length + " results found. " + numberOfResultsIncluded + " results included.");
          }

          for(var k = 0; k < googleResults.length && k < numberOfResultsIncluded; k++) {
                  var currentResult = googleResults[k];
                  var link = currentResult.getElementsByTagName("a")[0];
                  var title = link.innerHTML;
                  var url = link.href;
                  var infoDiv = "";

                  if(!excludeUnplausibleYear || title.search(Rating.movieYear) > 0) {
                          if(SEARCH_GOOGLE_RESULT_INFO) {
                                  infoDiv = currentResult.getElementsByClassName("st")[0].outerHTML;
                          }
                          title = Refinery.refineString(title)
                          var regExp;
                          for(var l = 0; l < blacklistedStrings.length; l++) { //delete unwanted strings
                                  title = title.replace(blacklistedStrings[l], '');
                          }
                          title = title.replace(Rating.movieYear, '');
                          title = Refinery.refineString(title);
                          var titleSplits = title.split(' ');

                          //Try to match movie titles with the results (and result infos)
                          var j = 0;
                          correctnessIndicator = 0;
                          spamIndicator = 0;
                          while(j < movieAliases.length && (bestCorrectnessResult < 1 || bestSpamResult < 1)) {
                                  foundCounter = 0;
                                  var movieAliasSplits = movieAliases[j].split(' ');
                                  // Heuristic - at least half of the movie titles words have to be found in a result
                                  for(var i = 0; i < movieAliasSplits.length; i++) {
                                          var regExp = new RegExp('(^|\\s|>)'+movieAliasSplits[i]+'(\\s|$)', 'i');
                                          if(matchInArray(titleSplits, regExp) || (SEARCH_GOOGLE_RESULT_INFO && infoDiv.search(regExp) >= 0)) {
                                                  foundCounter++;
                                          }
                                  }
                                  correctnessIndicator = Math.round((foundCounter/movieAliasSplits.length)*100)/100;
                                  spamIndicator = Math.round((foundCounter/titleSplits.length)*100)/100;
                                  if(url.search(websiteURL) >= 0 && correctnessIndicator >= 0.5 && spamIndicator >= 0.5) { //Threshold for accepted results
                                          if(DEBUG_MODE && VERBOSE) {
                                                  log("Result "+(k+1)+" matched. Correct: "+correctnessIndicator+" Spam: "+spamIndicator);
                                          }
                                          if(correctnessIndicator > bestCorrectnessResult || ( correctnessIndicator >= bestCorrectnessResult && spamIndicator > bestSpamResult)) {
                                                  if (DEBUG_MODE && VERBOSE) {
                                                          log("New best: Result "+(k+1)+" Correct: "+correctnessIndicator+" Spam: "+spamIndicator);
                                                  }
                                                  bestResultIndex = k;
                                                  bestCorrectnessResult = correctnessIndicator;
                                                  bestSpamResult = spamIndicator;
                                          } else if (DEBUG_MODE && VERBOSE) {
                                                  log("Close: Result "+(k+1)+" Correct: "+correctnessIndicator+" Spam: "+spamIndicator);
                                          }
                                  } else if (DEBUG_MODE && VERBOSE) {
                                          log("Result "+(k+1)+" was excluded: Correct: "+correctnessIndicator+" Spam: "+spamIndicator);
                                  }
                                  j++;
                          }
                  } else {
                          if(DEBUG_MODE && VERBOSE) {
                                  log("Result "+(k+1)+" was excluded: Wrong Year.");
                          }
                  }
          }
          var indicator = bestCorrectnessResult * bestSpamResult;
          if(indicator >= 0.25) {
                  if (DEBUG_MODE && VERBOSE) {
                          log("Final result: "+(bestResultIndex+1)+". Correct: "+bestCorrectnessResult+" Spam: "+bestSpamResult+" Result: "+indicator);
                  }
                  if(indicator == 1) { //all words were found
                    estCorrectness = Rating.correctness.PERFECT;
                  } else if(indicator >= 0.75) {
                    estCorrectness = Rating.correctness.GOOD;
                  } else if(indicator >= 0.5) {
                    estCorrectness = Rating.correctness.OKAY;
                  } else if(indicator >= 0.25) {
                    estCorrectness = Rating.correctness.BAD;
                  }
                  return [googleResults[bestResultIndex].getElementsByTagName("a")[0].href, googleResults[bestResultIndex]];
          } else {
                  return null;
          }
  }

  function getRatingByGoogle(googleResult) {
  /* Standard scrapper for Googles ratings */

          var ratingDiv = googleResult.querySelector("div.f.slp")
          if(ratingDiv !== null && ratingDiv.childNodes.length >= 2) {
                  var ratingText = Refinery.refineHTML(ratingDiv.childNodes[1].nodeValue);
                  ratingText = ratingText.match(/\d,?\d?\/10 - \d(\d|\.)*/);
                  if(ratingText !== null) {
                          ratingText = ratingText[0].split('-')
                          var rating = ratingText[0].trim();
                          var ratingCount = ratingText[1].trim()
                          return MPRatingFactory.buildRating(Refinery.refineRating(rating), ratingSiteAbbr, Refinery.refineRatingCount(ratingCount), ratingRange, estCorrectness, ratingDivId);
                  }
          }
          return MPRatingFactory.getNotYetRating(ratingSiteAbbr, ratingRange, estCorrectness, ratingId);
  }

  function sendRequest(request) {
  /* Absetzen eines Requests
  *
  * request      Ziel-URL mit Request
  * source       Anzeige-Information
  */
    if (this.REQ_SYNCHRONOUS) {  //synchronous or asynchronous
      var response = GM.xmlHttpRequest({
        method: 'GET',
        url: request,
        synchronous: this.REQ_SYNCHRONOUS,
        timeout: this.REQ_TIMEOUT,
        ontimeout: function(response) {
          console.log("Timeout(MP-Rating-Extension):  "+request);
        }
      });

      if(response.status == 200) {
        ratingObject.callback(request, response);
      } else {
        alert("Error: No synchornous operation.");
      }
    } else {
      GM.xmlHttpRequest({
        method: 'GET',
        url: request,
        synchronous: this.REQ_SYNCHRONOUS,
        timeout: this.REQ_TIMEOUT,
        onreadystatechange: function(response) {
          if(response.readyState == 4) {
            if(response.status == 200) { //Successfull request
              callback(request, response);
            } else if(response.status >= 500 && response.status < 600) {
              //Server error
              var rating = null;
              if(DEBUG_MODE) {
                log("ERROR: Status-Code: " + response.status)
              }
              if(response.finalUrl.match(/(ipv4|ipv6).google.(de|com)\/sorry/) !== null) { //Blocked by Google; Too many requests
                MPExtension.appendNewContainer('google');
                rating = MPRatingFactory.wrapRatingWithLink(MPRatingFactory.buildInfo('Google blocked','Click and enter captcha to unlock', 'google'), request);
                MPExtension.addRatingToContainer('google', rating);
              }
            } else { //Default error
              if(DEBUG_MODE) {
                log("ERROR: Status-Code: " + response.status)
              }
              rating = MPRatingFactory.getErrorRating(ratingSite, ratingRange, ratingDivId);
              MPExtension.addRatingToContainer(ratingId, rating);
            }
          }
        }
      });
    }
  }

  function parseToHTMLElement(html) {
  /* Parse a  */
          var div = document.createElement("div");
          div.innerHTML = html;
          return div;
  }

  log(info) {
    /* Predefined logging method */
    console.log("MP-R-Ext: " + ratingSiteAbbr + ": " + info);
  }

}
