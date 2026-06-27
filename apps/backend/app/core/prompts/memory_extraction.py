"""
Memory Extraction Prompt
"""

MEMORY_EXTRACTION_PROMPT = """
Analyze the following conversation and extract structured information about the user.

You MUST respond with ONLY valid JSON. No other text. Your response must start with {{ and end with }}.

Extract the following in this exact JSON format:
{{
  "facts": ["fact1", "fact2"],
  "emotions": ["emotion1", "emotion2"],
  "people_mentioned": ["person1", "person2"],
  "topics": ["topic1", "topic2"],
  "summary": "A brief summary of what was learned about the user in this conversation",
  "mood_tag": "positive|negative|neutral|anxious|happy|sad|excited|calm|frustrated|hopeful"
}}

Keep the summary concise (2-3 sentences). Extract at least 3-5 facts if available. If no facts are available, use empty array.
Determine the overall mood of the user's most recent message and assign one mood_tag from the list.

Conversation:
{conversation_text}

Remember: Respond with ONLY the JSON object. No markdown, no explanations, no other text.
"""
