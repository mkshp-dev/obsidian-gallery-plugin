# Stress Test Image URLs

This file contains 50 image URLs for testing the gallery plugin's performance, lazy loading, and external image handling. Use these in `obs-gallery` code blocks to stress test the plugin.

## Test Configuration

Add this to a test note in your vault:

````markdown
```obs-gallery
view: thumbnail
urls:
  # Unsplash Sample Images (High Quality)
  - https://picsum.photos/800/600?random=1
  - https://picsum.photos/800/600?random=2
  - https://picsum.photos/800/600?random=3
  - https://picsum.photos/800/600?random=4
  - https://picsum.photos/800/600?random=5
  - https://picsum.photos/800/600?random=6
  - https://picsum.photos/800/600?random=7
  - https://picsum.photos/800/600?random=8
  - https://picsum.photos/800/600?random=9
  - https://picsum.photos/800/600?random=10
  
  # Different Aspect Ratios
  - https://picsum.photos/1200/800?random=11
  - https://picsum.photos/600/900?random=12
  - https://picsum.photos/1000/500?random=13
  - https://picsum.photos/500/1000?random=14
  - https://picsum.photos/1600/900?random=15
  
  # Various Sizes for Performance Testing
  - https://picsum.photos/400/300?random=16
  - https://picsum.photos/1920/1080?random=17
  - https://picsum.photos/300/400?random=18
  - https://picsum.photos/2560/1440?random=19
  - https://picsum.photos/640/480?random=20
  
  # HTTPs Cat Images (Fun + Different Server)
  - https://http.cat/200.jpg
  - https://http.cat/404.jpg
  - https://http.cat/500.jpg
  - https://http.cat/403.jpg
  - https://http.cat/418.jpg
  
  # JSONPlaceholder Images (Different CDN)
  - https://via.placeholder.com/800x600/FF6B6B/FFFFFF?text=Image+26
  - https://via.placeholder.com/800x600/4ECDC4/FFFFFF?text=Image+27
  - https://via.placeholder.com/800x600/45B7D1/FFFFFF?text=Image+28
  - https://via.placeholder.com/800x600/96CEB4/FFFFFF?text=Image+29
  - https://via.placeholder.com/800x600/FECA57/FFFFFF?text=Image+30
  
  # More Random Images
  - https://picsum.photos/800/600?random=31
  - https://picsum.photos/800/600?random=32
  - https://picsum.photos/800/600?random=33
  - https://picsum.photos/800/600?random=34
  - https://picsum.photos/800/600?random=35
  - https://picsum.photos/800/600?random=36
  - https://picsum.photos/800/600?random=37
  - https://picsum.photos/800/600?random=38
  - https://picsum.photos/800/600?random=39
  - https://picsum.photos/800/600?random=40
  
  # Large Images for Memory Testing
  - https://picsum.photos/3840/2160?random=41
  - https://picsum.photos/2048/1536?random=42
  - https://picsum.photos/4096/3072?random=43
  
  # Small Images
  - https://picsum.photos/200/150?random=44
  - https://picsum.photos/150/200?random=45
  
  # Different Formats via Placeholder Services
  - https://via.placeholder.com/800x600/FF0000/FFFFFF.png?text=PNG+Image
  - https://via.placeholder.com/800x600/00FF00/FFFFFF.jpg?text=JPG+Image
  - https://via.placeholder.com/800x600/0000FF/FFFFFF.gif?text=GIF+Image
  
  # Edge Case URLs
  - https://picsum.photos/1/1?random=48
  - https://picsum.photos/5000/5000?random=49
  - https://picsum.photos/800/600?random=50
```
````

## Alternative Test Configurations

### Grid View Test (Masonry)
````markdown
```obs-gallery
view: grid
urls:
  - https://picsum.photos/400/600?random=1
  - https://picsum.photos/600/400?random=2
  - https://picsum.photos/500/800?random=3
  - https://picsum.photos/800/300?random=4
  - https://picsum.photos/300/500?random=5
  - https://picsum.photos/700/700?random=6
  - https://picsum.photos/400/900?random=7
  - https://picsum.photos/900/400?random=8
  - https://picsum.photos/500/500?random=9
  - https://picsum.photos/600/800?random=10
```
````

### Carousel View Test
````markdown
```obs-gallery
view: carousel
urls:
  - https://picsum.photos/1200/800?random=1
  - https://picsum.photos/1200/800?random=2
  - https://picsum.photos/1200/800?random=3
  - https://picsum.photos/1200/800?random=4
  - https://picsum.photos/1200/800?random=5
  - https://picsum.photos/1200/800?random=6
  - https://picsum.photos/1200/800?random=7
  - https://picsum.photos/1200/800?random=8
  - https://picsum.photos/1200/800?random=9
  - https://picsum.photos/1200/800?random=10
```
````

## Testing Scenarios

### Performance Testing
1. **Lazy Loading**: Scroll slowly through the 50-image gallery and observe loading behavior
2. **Memory Usage**: Open browser dev tools and monitor memory consumption
3. **Network**: Check network tab for concurrent request limits and timing
4. **Scroll Performance**: Rapid scrolling to test intersection observer performance

### Error Handling Testing
Add some invalid URLs to test error states:
```yaml
urls:
  - https://invalid-domain-that-does-not-exist.com/image.jpg
  - https://httpstat.us/404.jpg
  - https://httpstat.us/500.jpg
  - https://picsum.photos/800/600?random=1  # Valid for comparison
```

### Timeout Testing
Set a very low timeout in plugin settings (e.g., 1000ms) and test with:
```yaml
urls:
  - https://httpstat.us/200?sleep=5000  # 5 second delay
  - https://picsum.photos/800/600?random=1  # Should load normally
```

### Large Image Testing
Test memory handling with very large images:
```yaml
urls:
  - https://picsum.photos/8192/6144?random=1  # 8K image
  - https://picsum.photos/4096/4096?random=2  # Square 4K
  - https://picsum.photos/10000/1000?random=3 # Very wide
  - https://picsum.photos/1000/10000?random=4 # Very tall
```

## Expected Behavior

### Good Performance Indicators
- Images load progressively as you scroll (lazy loading)
- Smooth scrolling without jank
- Memory usage stays reasonable (< 500MB for 50 images)
- Network requests are throttled appropriately
- Error states display professionally for failed images

### Stress Test Metrics
- **Load Time**: Initial render should be < 2 seconds
- **Memory**: Should not exceed 1GB RAM for 50 images
- **Network**: Should respect browser connection limits (6-8 concurrent)
- **Scroll Performance**: 60fps scrolling on modern devices
- **Error Resilience**: Plugin should remain functional even with failed images

## Testing Checklist

- [ ] Enable "Allow remote images" in plugin settings
- [ ] Set reasonable timeout (30000ms recommended for testing)
- [ ] Test with all 50 images in thumbnail view
- [ ] Test with different view types (grid, carousel)
- [ ] Monitor browser dev tools during testing
- [ ] Test scrolling performance
- [ ] Test with network throttling enabled
- [ ] Verify error handling with invalid URLs
- [ ] Test modal expansion with external images
- [ ] Test settings changes (timeout, validation) with active gallery

## Notes

- **picsum.photos** provides high-quality random images, good for realistic testing
- **via.placeholder.com** provides fast-loading placeholder images
- **http.cat** provides fun status code images
- URLs include various sizes and aspect ratios to test layout algorithms
- Some URLs intentionally use different CDNs to test diverse network conditions

Remember to test with both fast and slow internet connections, and verify the plugin gracefully handles network errors and timeouts!