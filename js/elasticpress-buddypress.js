window.elasticPressBuddyPress = {

  // markup for various UI elements
  loaderDiv: '<div class="epbp-loader"><img src="/app/plugins/elasticpress-buddypress/img/ajax-loader.gif"></div>',
  noMoreResultsDiv: '<div class="epbp-msg no-more-results">No more results.</div>',
  noResultsDiv: '<div class="epbp-msg no-results">No results.</div>',
  errorDiv: '<div class="epbp-msg error">Something went wrong! Please try a different query.</div>',

  // are we presently awaiting results?
  loading: false,

  // request in progress, if any
  xhr: null,

  // what page of results are we loading?
  page: 1,

  // element to which results are appended ( set in init() since it doesn't exist until document.ready )
  target: null,

  // helper function to customize jQuery.tabselect initialization for multiselect search facets
  initTabSelect: function( formElement, targetElement ) {
    var tabElements = [];
    var selectedTabs = [];

    $( formElement ).children().each( function( i, el ) {
      tabElements.push( el.innerHTML );

      if ( $( el ).prop( 'selected' ) ) {
        selectedTabs.push( el.innerHTML );
      }
    } );

    $( targetElement ).tabSelect( {
      tabElements: tabElements,
      selectedTabs: selectedTabs,
      formElement: formElement,
      onChange: function( selected ) {
        // select & deselect options
        $( formElement ).children().each( function() {
          // use .attr() rather than .prop() so that serializeArray() finds these elements.
          $( this ).attr( 'selected', ( $.inArray( this.innerHTML, selected ) !== -1 ) );
        } );

        // trigger handleFacetChange
        $( formElement ).trigger( 'change' );
      }
    } );
  },

  // change handler for search facets
  handleFacetChange: function() {
    $( '.epbp-loader' ).remove();
    $( '.ep-bp-search-facets' ).append( elasticPressBuddyPress.loaderDiv );
    elasticPressBuddyPress.page = 1;
    elasticPressBuddyPress.loadResults();
  },

  // "change" (really, keyup) handler for search input
  handleSearchInputChange: function() {
    // only process change if the value of the input actually changed (not some other key press)
    if ( $( '#s' ).val() !== $( '#ep-bp-facets [name=s]' ).val() ) {
      $( '.epbp-loader' ).remove();
      $( '.ep-bp-search-facets' ).append( elasticPressBuddyPress.loaderDiv );
      $( '#ep-bp-facets [name=s]' ).val( $( '#s' ).val() );
      elasticPressBuddyPress.page = 1;
      elasticPressBuddyPress.loadResults();
    }
  },

  // initiate a new xhr to fetch results, then render them
  loadResults: function() {
    var serializedFacets = $( '.ep-bp-search-facets' ).serializeArray();

    serializedFacets.push( {
      name: 'paged',
      value: elasticPressBuddyPress.page
    } );

    for ( var i = 0; i < serializedFacets.length; i++ ) {
      serializedFacets[ i ].value = $.trim( serializedFacets[ i ].value );
    }

    serializedFacets = $.param( serializedFacets );

    elasticPressBuddyPress.loading = true;
    if ( elasticPressBuddyPress.page > 1 ) {
      elasticPressBuddyPress.target.append( elasticPressBuddyPress.loaderDiv );
    } else {
      elasticPressBuddyPress.target.addClass( 'in-progress' );
    }

    // abort pending request, if any, before starting a new one
    if ( elasticPressBuddyPress.xhr && 'abort' in elasticPressBuddyPress.xhr ) {
      elasticPressBuddyPress.xhr.abort();
    }

    // TODO set ajax path with wp_localize_script() from EPR_REST_Posts_Controller property
    elasticPressBuddyPress.xhr = $.getJSON( '/wp-json/epr/v1/query?' + serializedFacets )
      .success( function( data ) {
        // clear existing results unless we're infinite scrolling
        if ( elasticPressBuddyPress.page === 1 ) {
          elasticPressBuddyPress.target.html( '' );
        }

        if ( data.posts.length ) {
          // remove results which are already listed on other network(s)
          // this is done serverside too but only affects one page at a time
          // doing it again here prevents dupes when they appear on different pages
          $.each( data.posts, function( i, thisPost ) {
            $.each( elasticPressBuddyPress.target.children( 'article' ), function( j, thatPost ) {
              if (
                $( thisPost ).attr( 'id' ).split('-')[1] === $( thatPost ).attr( 'id' ).split('-')[1] &&
                $( thisPost ).find( '.entry-title' ).text() === $( thatPost ).find( '.entry-title' ).text() &&
                $( thisPost ).find( '.entry-title a' ).attr( 'href' ) !== $( thatPost ).find( '.entry-title a' ).attr( 'href' )
              ) {
                delete data.posts[i];
              }
            } );
          } );

          elasticPressBuddyPress.target.append( data.posts.join( '' ) );

          if ( window.history && window.history.pushState ) {
            window.history.pushState( data, '', window.location.pathname + '?' + serializedFacets );
          }
        } else {
          if ( elasticPressBuddyPress.page > 1 ) {
            elasticPressBuddyPress.target.append( elasticPressBuddyPress.noMoreResultsDiv );
          } else {
            elasticPressBuddyPress.target.append( elasticPressBuddyPress.noResultsDiv );
          }
        }
      } )
      .error( function( request ) {
        if ( request.statusText !== 'abort' ) {
          elasticPressBuddyPress.target.html( elasticPressBuddyPress.errorDiv );
        }
      } )
      .complete( function( request ) {
        if ( request.statusText !== 'abort' ) {
          $( '.epbp-loader' ).remove();
          elasticPressBuddyPress.target.removeClass( 'in-progress' );
          elasticPressBuddyPress.loading = false;
        }
      } );
  },

  // automatically hide & show relevant order options
  updateOrderSelect: function() {
    // makes no sense to offer the option to sort least relevant results first,
    // so hide order when sorting by score.
    // boss adds markup to all selects so we must hide those too for now.
    if ( $( '#orderby' ).val() === '_score' ) {

      // in case user had selected asc, reset
      if ( $( '#order' ).val() !== 'desc' ) {
        $( '#order [value="asc"]' ).attr( 'selected', false );
        $( '#order [value="desc"]' ).attr( 'selected', true );
        $( this ).trigger( 'change' );
      }

      $( '#order' ).hide(); // theme-independent, hopefully
      $( '#order' ).parents( '.buddyboss-select' ).css( 'opacity', 0 ); // boss

    } else {

      $( '#order' ).show();
      $( '#order' ).parents( '.buddyboss-select' ).css( 'opacity', 1 );

    }
  },

  // set up tabselect, event handlers, etc.
  init: function() {
    elasticPressBuddyPress.target = $( '#content' );

    elasticPressBuddyPress.initTabSelect( 'select[name=post_type\\[\\]]', '#ep_bp_post_type_facet' );
    elasticPressBuddyPress.initTabSelect( 'select[name=index\\[\\]]', '#ep_bp_index_facet' );

    $( '#ep-bp-facets' ).find( 'select' ).on( 'change', elasticPressBuddyPress.handleFacetChange );
    $( '#ep-bp-facets' ).find( 'input' ).on( 'keyup', elasticPressBuddyPress.handleFacetChange );

    $( '#s' ).val( $.trim( $( '#ep-bp-facets [name=s]' ).val() ) );

    // prevent native form submission since we're running on ajax instead
    $( '#searchform' ).on( 'submit', function( e ) {
      e.preventDefault();
    } );
    $( '#ep-bp-facets' ).on( 'submit', function( e ) {
      e.preventDefault();
    } );

    $( '#orderby' ).on( 'change', elasticPressBuddyPress.updateOrderSelect );

    // trigger the #orderby change handler once boss Selects have initialized
    var observer = new MutationObserver( function() {
      if ( $( '.ep-bp-search-facets' ).children( '.buddyboss-select' ).length && $( '#orderby' ).val() === '_score' ) {
        elasticPressBuddyPress.updateOrderSelect();
        observer.disconnect();
      }
    } );

    observer.observe( $( '.ep-bp-search-facets' )[0], { childList: true } );

    $( '#s' ).on( 'keyup', elasticPressBuddyPress.handleSearchInputChange );

    $( window ).on( 'scroll', function ( event ) {
      var targetScrollTop =
        elasticPressBuddyPress.target.offset().top +
        elasticPressBuddyPress.target.outerHeight() -
        window.innerHeight * 3;

      if(
        ! elasticPressBuddyPress.target.children( '.epbp-msg' ).length &&
        ! elasticPressBuddyPress.loading &&
        ( $( window ).scrollTop() >= targetScrollTop || elasticPressBuddyPress.target.children().length < 10 )
      ) {
        elasticPressBuddyPress.page++;
        elasticPressBuddyPress.xhr = elasticPressBuddyPress.loadResults();
      }
    } );
  }
}

$( elasticPressBuddyPress.init );
