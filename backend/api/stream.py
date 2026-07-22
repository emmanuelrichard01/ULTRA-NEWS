import asyncio
import json
from django.http import StreamingHttpResponse
from asgiref.sync import sync_to_async
from django.core.cache import cache

@sync_to_async
def get_latest_stories(since_id: int):
    from core.models import Story
    # Get stories created strictly after since_id
    stories = Story.objects.filter(id__gt=since_id).order_by('id')[:5]
    if not stories:
        return None, since_id
        
    items = []
    max_id = since_id
    for s in stories:
        max_id = max(max_id, s.id)
        items.append({
            "id": s.id,
            "title": s.title,
            "slug": s.slug,
            "velocity_score": s.velocity_score,
            "status": s.status,
            "first_seen_at": s.first_seen_at.isoformat()
        })
    return items, max_id

@sync_to_async
def get_initial_max_id():
    from core.models import Story
    last_story = Story.objects.order_by('-id').first()
    return last_story.id if last_story else 0

async def breaking_news_stream(request):
    """
    SSE endpoint for the breaking news ticker.
    Polls the database for new stories (by ID) and yields SSE events.
    """
    async def event_stream():
        last_id = await get_initial_max_id()
        
        # Send initial connection event
        yield f"event: connected\ndata: {json.dumps({'status': 'listening'})}\n\n"
        
        while True:
            try:
                # Check for new stories
                items, new_max_id = await get_latest_stories(last_id)
                
                if items:
                    last_id = new_max_id
                    for item in items:
                        # Only send breaking/developing/corroborated
                        if item["status"] in ["developing", "corroborated", "breaking"]:
                            yield f"event: new_story\ndata: {json.dumps(item)}\n\n"
                
                # Ping to keep connection alive
                yield f"event: ping\ndata: {json.dumps({'ping': 'pong'})}\n\n"
                
                # Sleep before polling again
                await asyncio.sleep(5)
            except asyncio.CancelledError:
                break
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
                await asyncio.sleep(5)
                
    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'  # For Nginx
    response['Access-Control-Allow-Origin'] = '*'
    return response
