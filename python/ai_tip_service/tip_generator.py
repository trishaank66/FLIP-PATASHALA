"""
AI Tip Generator Module

This module contains functions for generating personalized tips for students,
faculty, and administrators based on their interactions with the system.
"""

import os
import json
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans
import spacy
from anthropic import Anthropic

# Initialize Anthropic client
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
anthropic_client = None

if ANTHROPIC_API_KEY:
    try:
        anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)
    except Exception as e:
        print(f"Error initializing Anthropic client: {e}")

# Load spaCy model
try:
    # Use a smaller model for efficiency
    nlp = spacy.load("en_core_web_sm")
except Exception as e:
    print(f"Error loading spaCy model: {e}")
    # Create a blank model as fallback
    nlp = spacy.blank("en")

# Constants
MAX_TIPS_PER_USER = 5
TIP_EXPIRY_DAYS = 7  # Tips expire after 7 days

class TipGenerator:
    def __init__(self, db_connection=None):
        """
        Initialize the TipGenerator with a database connection
        """
        self.db_connection = db_connection
        
    def _get_quiz_data(self, user_id: int) -> pd.DataFrame:
        """
        Get quiz attempt data for a specific user or all users
        
        Args:
            user_id: User ID or None for all users
            
        Returns:
            DataFrame with quiz attempt data
        """
        query = """
        SELECT 
            qa.id, qa.quiz_id, qa.student_id, qa.score, qa.answers, qa.feedback,
            qa.completed_at, q.subject, q.difficulty, q.questions,
            u.first_name, u.last_name, u.role
        FROM 
            il_quiz_attempts qa
        JOIN 
            il_quizzes q ON qa.quiz_id = q.id
        JOIN 
            users u ON qa.student_id = u.id
        """
        
        if user_id:
            query += f" WHERE qa.student_id = {user_id}"
            
        query += " ORDER BY qa.completed_at DESC LIMIT 100"
        
        try:
            return pd.read_sql(query, self.db_connection)
        except Exception as e:
            print(f"Error getting quiz data: {e}")
            return pd.DataFrame()
    
    def _get_forum_data(self, user_id: int) -> pd.DataFrame:
        """
        Get forum activity data for a specific user or all users
        
        Args:
            user_id: User ID or None for all users
            
        Returns:
            DataFrame with forum activity data
        """
        query = """
        SELECT 
            fp.id, fp.user_id, fp.title, fp.content, fp.tags, 
            fp.created_at, fp.updated_at, fp.subject,
            u.first_name, u.last_name, u.role
        FROM 
            il_forum_posts fp
        JOIN 
            users u ON fp.user_id = u.id
        """
        
        if user_id:
            query += f" WHERE fp.user_id = {user_id}"
            
        query += " ORDER BY fp.created_at DESC LIMIT 100"
        
        try:
            df_posts = pd.read_sql(query, self.db_connection)
            
            # Also get forum replies
            query_replies = """
            SELECT 
                fr.id, fr.post_id, fr.user_id, fr.content, 
                fr.created_at, fr.updated_at,
                u.first_name, u.last_name, u.role
            FROM 
                il_forum_replies fr
            JOIN 
                users u ON fr.user_id = u.id
            """
            
            if user_id:
                query_replies += f" WHERE fr.user_id = {user_id}"
                
            query_replies += " ORDER BY fr.created_at DESC LIMIT 100"
            
            df_replies = pd.read_sql(query_replies, self.db_connection)
            
            # Combine the data (simplified for now)
            return pd.concat([df_posts, df_replies], ignore_index=True)
        except Exception as e:
            print(f"Error getting forum data: {e}")
            return pd.DataFrame()
    
    def _get_poll_data(self, user_id: int) -> pd.DataFrame:
        """
        Get poll participation data for a specific user or all users
        
        Args:
            user_id: User ID or None for all users
            
        Returns:
            DataFrame with poll data
        """
        query = """
        SELECT 
            pv.id, pv.poll_id, pv.user_id, pv.option_index, 
            pv.voted_at, p.question, p.options, p.subject,
            u.first_name, u.last_name, u.role
        FROM 
            il_poll_votes pv
        JOIN 
            il_polls p ON pv.poll_id = p.id
        JOIN 
            users u ON pv.user_id = u.id
        """
        
        if user_id:
            query += f" WHERE pv.user_id = {user_id}"
            
        query += " ORDER BY pv.voted_at DESC LIMIT 100"
        
        try:
            return pd.read_sql(query, self.db_connection)
        except Exception as e:
            print(f"Error getting poll data: {e}")
            return pd.DataFrame()
    
    def _get_notes_data(self, user_id: int) -> pd.DataFrame:
        """
        Get shared notes participation data for a specific user or all users
        
        Args:
            user_id: User ID or None for all users
            
        Returns:
            DataFrame with notes data
        """
        query = """
        SELECT 
            nc.id, nc.note_id, nc.user_id, nc.content, nc.content_type,
            nc.tags, nc.ai_processed, nc.contributed_at,
            sn.title, sn.subject, sn.description,
            u.first_name, u.last_name, u.role
        FROM 
            il_note_contributions nc
        JOIN 
            il_shared_notes sn ON nc.note_id = sn.id
        JOIN 
            users u ON nc.user_id = u.id
        """
        
        if user_id:
            query += f" WHERE nc.user_id = {user_id}"
            
        query += " ORDER BY nc.contributed_at DESC LIMIT 100"
        
        try:
            return pd.read_sql(query, self.db_connection)
        except Exception as e:
            print(f"Error getting notes data: {e}")
            return pd.DataFrame()
    
    def _get_engagement_data(self, user_id: int) -> Dict[str, Any]:
        """
        Get overall engagement metrics for a specific user or all users
        
        Args:
            user_id: User ID or None for all users
            
        Returns:
            Dictionary with engagement metrics
        """
        query = """
        SELECT 
            ue.user_id, ue.count, ue.stars_earned, ue.previous_week_count,
            u.first_name, u.last_name, u.role
        FROM 
            user_engagement ue
        JOIN 
            users u ON ue.user_id = u.id
        """
        
        if user_id:
            query += f" WHERE ue.user_id = {user_id}"
        
        try:
            df = pd.read_sql(query, self.db_connection)
            
            if df.empty:
                return {}
            
            # Get engagement history for more details
            history_query = """
            SELECT 
                eh.user_id, eh.interaction_type, COUNT(*) as count
            FROM 
                engagement_history eh
            """
            
            if user_id:
                history_query += f" WHERE eh.user_id = {user_id}"
                
            history_query += " GROUP BY eh.user_id, eh.interaction_type"
            
            df_history = pd.read_sql(history_query, self.db_connection)
            
            # Process into a dictionary format
            result = {
                "overall": df.to_dict(orient="records"),
                "by_type": df_history.to_dict(orient="records") if not df_history.empty else []
            }
            
            return result
        except Exception as e:
            print(f"Error getting engagement data: {e}")
            return {}
    
    def _analyze_student_performance(self, quiz_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Analyze student quiz performance to identify strengths and weaknesses
        
        Args:
            quiz_data: DataFrame with quiz attempts
            
        Returns:
            Dictionary with performance analysis
        """
        if quiz_data.empty:
            return {}
        
        # Extract subject performance
        subject_performance = {}
        for _, row in quiz_data.iterrows():
            subject = row.get('subject', 'Unknown')
            score = row.get('score', 0)
            
            if subject not in subject_performance:
                subject_performance[subject] = []
                
            subject_performance[subject].append(score)
        
        # Calculate average score by subject
        subject_averages = {
            subject: sum(scores) / len(scores) 
            for subject, scores in subject_performance.items()
        }
        
        # Find strongest and weakest subjects
        if subject_averages:
            strongest_subject = max(subject_averages.items(), key=lambda x: x[1])
            weakest_subject = min(subject_averages.items(), key=lambda x: x[1])
        else:
            strongest_subject = (None, 0)
            weakest_subject = (None, 0)
        
        # Find recent improvements
        recent_attempts = quiz_data.sort_values('completed_at', ascending=False)
        recent_subjects = recent_attempts['subject'].unique()
        
        improvements = {}
        for subject in recent_subjects:
            subject_attempts = recent_attempts[recent_attempts['subject'] == subject]
            
            if len(subject_attempts) >= 2:
                latest_score = subject_attempts.iloc[0]['score']
                previous_score = subject_attempts.iloc[1]['score']
                
                improvements[subject] = latest_score - previous_score
        
        # Find most improved subject
        most_improved = None
        most_improved_diff = 0
        
        for subject, diff in improvements.items():
            if diff > most_improved_diff:
                most_improved = subject
                most_improved_diff = diff
        
        return {
            "subject_averages": subject_averages,
            "strongest_subject": {
                "name": strongest_subject[0],
                "score": strongest_subject[1]
            },
            "weakest_subject": {
                "name": weakest_subject[0],
                "score": weakest_subject[1]
            },
            "most_improved": {
                "name": most_improved,
                "improvement": most_improved_diff
            }
        }
    
    def _analyze_forum_activity(self, forum_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Analyze forum activity to identify topics of interest and engagement patterns
        
        Args:
            forum_data: DataFrame with forum posts and replies
            
        Returns:
            Dictionary with forum activity analysis
        """
        if forum_data.empty:
            return {}
        
        # Extract topics using spaCy
        topics = []
        
        for _, row in forum_data.iterrows():
            text = row.get('content', '')
            if not text or not isinstance(text, str):
                continue
                
            doc = nlp(text[:5000])  # Limit text length for processing efficiency
            
            # Extract key phrases (noun chunks)
            chunks = [chunk.text.lower() for chunk in doc.noun_chunks]
            
            # Extract entities
            entities = [ent.text.lower() for ent in doc.ents]
            
            topics.extend(chunks + entities)
        
        # Count topic frequencies
        topic_counts = {}
        for topic in topics:
            if topic in topic_counts:
                topic_counts[topic] += 1
            else:
                topic_counts[topic] = 1
        
        # Get top topics
        top_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        
        # Get active days and times
        forum_data['date'] = pd.to_datetime(forum_data['created_at']).dt.date
        forum_data['hour'] = pd.to_datetime(forum_data['created_at']).dt.hour
        
        date_counts = forum_data['date'].value_counts().to_dict()
        hour_counts = forum_data['hour'].value_counts().to_dict()
        
        # Convert dates to strings for JSON serialization
        date_counts = {str(k): v for k, v in date_counts.items()}
        
        return {
            "top_topics": [{"topic": t[0], "count": t[1]} for t in top_topics],
            "activity_by_date": date_counts,
            "activity_by_hour": hour_counts
        }
    
    def _analyze_class_performance(self, quiz_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Analyze class-wide performance patterns for faculty insights
        
        Args:
            quiz_data: DataFrame with quiz attempts for a class
            
        Returns:
            Dictionary with class performance analysis
        """
        if quiz_data.empty:
            return {}
        
        # Group by subject and question
        performance_by_topic = {}
        student_performance = {}
        
        for _, row in quiz_data.iterrows():
            subject = row.get('subject', 'Unknown')
            student_id = row.get('student_id', 0)
            student_name = f"{row.get('first_name', '')} {row.get('last_name', '')}"
            score = row.get('score', 0)
            
            # Track by subject
            if subject not in performance_by_topic:
                performance_by_topic[subject] = []
            
            performance_by_topic[subject].append(score)
            
            # Track by student
            if student_id not in student_performance:
                student_performance[student_id] = {
                    'name': student_name,
                    'scores': []
                }
            
            student_performance[student_id]['scores'].append(score)
        
        # Calculate average by subject
        subject_averages = {
            subject: sum(scores) / len(scores)
            for subject, scores in performance_by_topic.items()
        }
        
        # Calculate average by student
        for student_id in student_performance:
            scores = student_performance[student_id]['scores']
            student_performance[student_id]['average'] = sum(scores) / len(scores)
        
        # Identify struggling and excelling students
        student_averages = {
            student_id: data['average']
            for student_id, data in student_performance.items()
        }
        
        struggling_threshold = 0.6  # Students with less than 60% average
        excelling_threshold = 0.85  # Students with more than 85% average
        
        struggling_students = {
            student_id: {
                'name': student_performance[student_id]['name'],
                'average': avg
            }
            for student_id, avg in student_averages.items()
            if avg < struggling_threshold
        }
        
        excelling_students = {
            student_id: {
                'name': student_performance[student_id]['name'],
                'average': avg
            }
            for student_id, avg in student_averages.items()
            if avg > excelling_threshold
        }
        
        # Find most challenging subject
        if subject_averages:
            most_challenging = min(subject_averages.items(), key=lambda x: x[1])
        else:
            most_challenging = (None, 0)
        
        return {
            "subject_averages": subject_averages,
            "most_challenging_subject": {
                "name": most_challenging[0],
                "average_score": most_challenging[1]
            },
            "struggling_students": struggling_students,
            "excelling_students": excelling_students,
            "class_average": sum(student_averages.values()) / len(student_averages) if student_averages else 0
        }
    
    def _generate_tip_with_claude(self, data: Dict[str, Any], user_type: str) -> List[Dict[str, Any]]:
        """
        Generate personalized tips using Claude API
        
        Args:
            data: Analyzed data to generate tips from
            user_type: Type of user (student, faculty, admin)
            
        Returns:
            List of tip dictionaries
        """
        if not anthropic_client:
            # Fall back to rule-based tips
            return self._generate_rule_based_tips(data, user_type)
        
        try:
            # Create a prompt based on user type and data
            if user_type == "student":
                prompt = self._create_student_tip_prompt(data)
            elif user_type == "faculty":
                prompt = self._create_faculty_tip_prompt(data)
            else:  # admin
                prompt = self._create_admin_tip_prompt(data)
            
            # Call Claude API for tip generation
            response = anthropic_client.messages.create(
                model="claude-3-7-sonnet-20250219",  # the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
                max_tokens=1024,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                system="You are an expert educational coach providing helpful, friendly tips for an educational platform. Provide advice in a clear, supportive tone a student would understand. Focus on being constructive and specific."
            )
            
            # Process Claude's response
            tips_text = response.content[0].text
            
            # Parse the response into structured tips
            tips = self._parse_claude_response(tips_text, user_type)
            
            return tips
        except Exception as e:
            print(f"Error generating tips with Claude: {e}")
            # Fall back to rule-based tips
            return self._generate_rule_based_tips(data, user_type)
    
    def _create_student_tip_prompt(self, data: Dict[str, Any]) -> str:
        """
        Create a prompt for generating student tips
        
        Args:
            data: Student performance data
            
        Returns:
            Prompt string for Claude
        """
        prompt = """Generate 3 helpful learning tips for a student based on their performance data:

Performance Data:
"""
        # Add performance information
        if "subject_averages" in data:
            prompt += "Subject Averages:\n"
            for subject, avg in data["subject_averages"].items():
                prompt += f"- {subject}: {avg:.1f}%\n"
        
        if "strongest_subject" in data and data["strongest_subject"]["name"]:
            prompt += f"\nStrongest Subject: {data['strongest_subject']['name']} ({data['strongest_subject']['score']:.1f}%)\n"
        
        if "weakest_subject" in data and data["weakest_subject"]["name"]:
            prompt += f"\nWeakest Subject: {data['weakest_subject']['name']} ({data['weakest_subject']['score']:.1f}%)\n"
        
        if "most_improved" in data and data["most_improved"]["name"]:
            prompt += f"\nMost Improved: {data['most_improved']['name']} (+{data['most_improved']['improvement']:.1f}%)\n"
        
        # Add forum insights if available
        if "top_topics" in data:
            prompt += "\nTopics of Interest:\n"
            for topic in data["top_topics"][:5]:
                prompt += f"- {topic['topic']}\n"
        
        prompt += """\nFormat each tip in JSON with the following format (make sure it's valid JSON):
[
  {
    "content": "The actual personalized tip text",
    "type": "quiz", // or "forum", "poll", "engagement" based on what the tip relates to
    "priority": 1, // number from 1-5, higher is more important
    "relevance_score": 0.85, // between 0-1, how relevant this tip is
    "action_link": "/interactive/[appropriate section]", // where the student should go to act on the tip
    "context": "Loops;Arrays;Algorithms", // semicolon-separated topics relevant to this tip
    "ui_style": "standard" // or "warning", "success", "info" based on the tip's nature
  },
  // (the other 2 tips...)
]

Tips should be specific, actionable, friendly, and written in simple language a student would understand. Each tip should highlight achievements and suggest a specific next step.
"""
        return prompt
    
    def _create_faculty_tip_prompt(self, data: Dict[str, Any]) -> str:
        """
        Create a prompt for generating faculty tips
        
        Args:
            data: Class performance data
            
        Returns:
            Prompt string for Claude
        """
        prompt = """Generate 3 helpful teaching insights for a faculty member based on their class performance data:

Class Performance Data:
"""
        # Add class performance information
        if "subject_averages" in data:
            prompt += "Subject Averages:\n"
            for subject, avg in data["subject_averages"].items():
                prompt += f"- {subject}: {avg:.1f}%\n"
        
        if "most_challenging_subject" in data and data["most_challenging_subject"]["name"]:
            prompt += f"\nMost Challenging Subject: {data['most_challenging_subject']['name']} ({data['most_challenging_subject']['average_score']:.1f}%)\n"
        
        if "class_average" in data:
            prompt += f"\nClass Average: {data['class_average']:.1f}%\n"
        
        if "struggling_students" in data:
            prompt += f"\nNumber of Struggling Students: {len(data['struggling_students'])}\n"
        
        if "excelling_students" in data:
            prompt += f"\nNumber of Excelling Students: {len(data['excelling_students'])}\n"
        
        prompt += """\nFormat each tip in JSON with the following format (make sure it's valid JSON):
[
  {
    "content": "The actual personalized faculty insight text",
    "type": "class_performance", // or "student_engagement", "topic_difficulty" based on what the insight relates to
    "priority": 1, // number from 1-5, higher is more important
    "relevance_score": 0.85, // between 0-1, how relevant this insight is
    "action_link": "/interactive/faculty/[appropriate section]", // where the faculty should go to act on the insight
    "context": "Loops;Algorithms;Class Performance", // semicolon-separated topics relevant to this insight
    "ui_style": "standard" // or "warning", "success", "info" based on the insight's nature
  },
  // (the other 2 insights...)
]

Insights should be specific, actionable, and helpful for improving teaching. Each insight should identify a pattern and suggest a specific action the faculty member can take.
"""
        return prompt
    
    def _create_admin_tip_prompt(self, data: Dict[str, Any]) -> str:
        """
        Create a prompt for generating admin insights
        
        Args:
            data: System performance data
            
        Returns:
            Prompt string for Claude
        """
        prompt = """Generate 3 helpful system insights for an administrator based on platform usage data:

Platform Data:
"""
        # Add system usage information
        prompt += f"Active Users: {data.get('active_users', 'Not available')}\n"
        prompt += f"Total Quizzes Taken: {data.get('total_quizzes', 'Not available')}\n"
        prompt += f"Total Forum Posts: {data.get('total_posts', 'Not available')}\n"
        prompt += f"Total Poll Votes: {data.get('total_votes', 'Not available')}\n"
        
        if "department_activity" in data:
            prompt += "\nDepartment Activity:\n"
            for dept, count in data["department_activity"].items():
                prompt += f"- {dept}: {count} interactions\n"
        
        prompt += """\nFormat each insight in JSON with the following format (make sure it's valid JSON):
[
  {
    "content": "The actual system insight text",
    "type": "system_health", // or "department_activity", "user_engagement" based on what the insight relates to
    "priority": 1, // number from 1-5, higher is more important
    "relevance_score": 0.85, // between 0-1, how relevant this insight is
    "action_link": "/admin/[appropriate section]", // where the admin should go to act on the insight
    "context": "System Health;User Engagement", // semicolon-separated topics relevant to this insight
    "ui_style": "standard" // or "warning", "success", "info" based on the insight's nature
  },
  // (the other 2 insights...)
]

Insights should be high-level and focus on system-wide patterns. Each insight should identify a trend and suggest an action if appropriate.
"""
        return prompt
    
    def _parse_claude_response(self, response: str, user_type: str) -> List[Dict[str, Any]]:
        """
        Parse Claude's response into structured tips
        
        Args:
            response: Text response from Claude
            user_type: Type of user
            
        Returns:
            List of tip dictionaries
        """
        try:
            # Find JSON array in the response
            start_idx = response.find('[')
            end_idx = response.rfind(']') + 1
            
            if start_idx >= 0 and end_idx > start_idx:
                json_str = response[start_idx:end_idx]
                return json.loads(json_str)
            
            # If we can't find proper JSON, create a basic tip
            return [{
                "content": response[:500],  # Truncate to a reasonable length
                "type": "general",
                "priority": 3,
                "relevance_score": 0.5,
                "action_link": f"/interactive/{user_type}/dashboard",
                "context": "Learning;Engagement",
                "ui_style": "standard"
            }]
        except Exception as e:
            print(f"Error parsing Claude response: {e}")
            # Return a fallback tip
            return [{
                "content": "Keep engaging with the platform to enhance your learning experience!",
                "type": "engagement",
                "priority": 3,
                "relevance_score": 0.5,
                "action_link": f"/interactive/{user_type}/dashboard",
                "context": "Learning;Engagement",
                "ui_style": "standard"
            }]
    
    def _generate_rule_based_tips(self, data: Dict[str, Any], user_type: str) -> List[Dict[str, Any]]:
        """
        Generate rule-based tips when Claude is not available
        
        Args:
            data: Analyzed user data
            user_type: Type of user
            
        Returns:
            List of tip dictionaries
        """
        tips = []
        
        if user_type == "student":
            # Add tip based on weakest subject
            if data.get("weakest_subject", {}).get("name"):
                subject = data["weakest_subject"]["name"]
                score = data["weakest_subject"]["score"]
                
                tips.append({
                    "content": f"You might benefit from additional practice with {subject} (current score: {score:.1f}%). Try reviewing related content or joining a discussion.",
                    "type": "quiz",
                    "priority": 4,
                    "relevance_score": 0.9,
                    "action_link": f"/interactive/content?subject={subject}",
                    "context": f"{subject};Improvement",
                    "ui_style": "standard"
                })
            
            # Add tip based on strongest subject
            if data.get("strongest_subject", {}).get("name"):
                subject = data["strongest_subject"]["name"]
                score = data["strongest_subject"]["score"]
                
                tips.append({
                    "content": f"Great job on {subject} (score: {score:.1f}%)! Consider exploring advanced topics or helping classmates in the forum.",
                    "type": "quiz",
                    "priority": 3,
                    "relevance_score": 0.8,
                    "action_link": f"/interactive/forum?subject={subject}",
                    "context": f"{subject};Excellence",
                    "ui_style": "success"
                })
            
            # Add engagement tip
            tips.append({
                "content": "Regular participation helps reinforce learning. Try joining a discussion or taking a poll today!",
                "type": "engagement",
                "priority": 2,
                "relevance_score": 0.7,
                "action_link": "/interactive/forum",
                "context": "Engagement;Participation",
                "ui_style": "info"
            })
            
        elif user_type == "faculty":
            # Add tip based on challenging subject
            if data.get("most_challenging_subject", {}).get("name"):
                subject = data["most_challenging_subject"]["name"]
                score = data["most_challenging_subject"]["average_score"]
                
                tips.append({
                    "content": f"Students are finding {subject} challenging (class average: {score:.1f}%). Consider creating additional resources or a review session.",
                    "type": "class_performance",
                    "priority": 4,
                    "relevance_score": 0.9,
                    "action_link": f"/interactive/faculty/content?subject={subject}",
                    "context": f"{subject};Teaching;Challenges",
                    "ui_style": "warning"
                })
            
            # Add tip about struggling students
            if data.get("struggling_students"):
                count = len(data["struggling_students"])
                
                tips.append({
                    "content": f"{count} students are scoring below 60%. Consider reaching out to offer additional support.",
                    "type": "student_engagement",
                    "priority": 5,
                    "relevance_score": 0.95,
                    "action_link": "/interactive/faculty/students",
                    "context": "Student Support;Intervention",
                    "ui_style": "warning"
                })
            
            # Add tip about excelling students
            if data.get("excelling_students"):
                count = len(data["excelling_students"])
                
                tips.append({
                    "content": f"{count} students are excelling with scores above 85%. Consider offering enrichment activities to maintain engagement.",
                    "type": "student_engagement",
                    "priority": 3,
                    "relevance_score": 0.8,
                    "action_link": "/interactive/faculty/content",
                    "context": "Excellence;Enrichment",
                    "ui_style": "success"
                })
                
        else:  # admin tips
            # General activity tip
            tips.append({
                "content": f"Platform is seeing active engagement with {data.get('total_quizzes', 0)} quizzes taken and {data.get('total_posts', 0)} forum posts.",
                "type": "system_health",
                "priority": 3,
                "relevance_score": 0.8,
                "action_link": "/admin/dashboard",
                "context": "System Health;Engagement",
                "ui_style": "standard"
            })
            
            # Department activity tip
            if data.get("department_activity"):
                most_active = max(data["department_activity"].items(), key=lambda x: x[1], default=(None, 0))
                least_active = min(data["department_activity"].items(), key=lambda x: x[1], default=(None, 0))
                
                if most_active[0]:
                    tips.append({
                        "content": f"{most_active[0]} is the most active department with {most_active[1]} interactions.",
                        "type": "department_activity",
                        "priority": 2,
                        "relevance_score": 0.7,
                        "action_link": f"/admin/departments?id={most_active[0]}",
                        "context": f"{most_active[0]};Engagement",
                        "ui_style": "success"
                    })
                
                if least_active[0] and least_active[1] > 0:
                    tips.append({
                        "content": f"{least_active[0]} is the least active department with only {least_active[1]} interactions. Consider promoting engagement.",
                        "type": "department_activity",
                        "priority": 4,
                        "relevance_score": 0.85,
                        "action_link": f"/admin/departments?id={least_active[0]}",
                        "context": f"{least_active[0]};Engagement",
                        "ui_style": "warning"
                    })
            
        # If we couldn't generate enough tips, add a generic one
        if len(tips) < 3:
            tips.append({
                "content": "Keep using the platform to access more personalized recommendations!",
                "type": "engagement",
                "priority": 1,
                "relevance_score": 0.6,
                "action_link": f"/interactive/{user_type}/dashboard",
                "context": "Engagement;Learning",
                "ui_style": "info"
            })
        
        return tips[:3]  # Return at most 3 tips
    
    def _get_related_content(self, context: str) -> List[Dict[str, Any]]:
        """
        Find content related to the given context
        
        Args:
            context: Semicolon-separated context topics
            
        Returns:
            List of related content items
        """
        if not context:
            return []
        
        topics = context.split(';')
        
        # Only use the first topic for simplicity
        topic = topics[0] if topics else None
        
        if not topic:
            return []
        
        query = f"""
        SELECT 
            c.id, c.title, c.type, c.url, c.subject
        FROM 
            content c
        WHERE 
            c.is_deleted = FALSE
            AND (
                c.title ILIKE '%{topic}%'
                OR c.description ILIKE '%{topic}%'
                OR c.subject ILIKE '%{topic}%'
                OR EXISTS (
                    SELECT 1 FROM unnest(c.tags) tag
                    WHERE tag ILIKE '%{topic}%'
                )
            )
        LIMIT 3
        """
        
        try:
            df = pd.read_sql(query, self.db_connection)
            
            if df.empty:
                return []
                
            return df.to_dict(orient='records')
        except Exception as e:
            print(f"Error getting related content: {e}")
            return []
    
    def generate_tips_for_user(self, user_id: int, user_role: str = None) -> List[Dict[str, Any]]:
        """
        Generate personalized tips for a specific user
        
        Args:
            user_id: User ID
            user_role: User role (student, faculty, admin)
            
        Returns:
            List of tip dictionaries
        """
        # If user_role is not provided, get it from the database
        if not user_role:
            try:
                query = f"SELECT role FROM users WHERE id = {user_id}"
                df = pd.read_sql(query, self.db_connection)
                user_role = df.iloc[0]['role'] if not df.empty else 'student'
            except Exception as e:
                print(f"Error getting user role: {e}")
                user_role = 'student'  # Default to student
        
        # Get data based on user role
        if user_role == 'student':
            # Get student data
            quiz_data = self._get_quiz_data(user_id)
            forum_data = self._get_forum_data(user_id)
            engagement_data = self._get_engagement_data(user_id)
            
            # Analyze student data
            performance_analysis = self._analyze_student_performance(quiz_data)
            forum_analysis = self._analyze_forum_activity(forum_data)
            
            # Combine analyses
            data = {**performance_analysis, **forum_analysis}
            
            # Generate tips
            tips = self._generate_tip_with_claude(data, "student")
            
        elif user_role == 'faculty':
            # For faculty, get class-wide data
            # (In a real system, this would be filtered to the faculty's classes)
            quiz_data = self._get_quiz_data(None)  # Get all student quiz data
            
            # Analyze class data
            class_analysis = self._analyze_class_performance(quiz_data)
            
            # Generate tips
            tips = self._generate_tip_with_claude(class_analysis, "faculty")
            
        else:  # admin
            # Get system-wide statistics
            try:
                stats_query = """
                SELECT
                    (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
                    (SELECT COUNT(*) FROM il_quiz_attempts) as total_quizzes,
                    (SELECT COUNT(*) FROM il_forum_posts) as total_posts,
                    (SELECT COUNT(*) FROM il_poll_votes) as total_votes
                """
                stats_df = pd.read_sql(stats_query, self.db_connection)
                stats = stats_df.iloc[0].to_dict() if not stats_df.empty else {}
                
                # Get department activity
                dept_query = """
                SELECT 
                    d.name, COUNT(eh.id) as interaction_count
                FROM 
                    departments d
                LEFT JOIN 
                    users u ON u.department_id = d.id
                LEFT JOIN 
                    engagement_history eh ON eh.user_id = u.id
                GROUP BY 
                    d.name
                """
                dept_df = pd.read_sql(dept_query, self.db_connection)
                
                dept_activity = {}
                for _, row in dept_df.iterrows():
                    dept_activity[row['name']] = row['interaction_count']
                
                # Combine data
                data = {
                    **stats,
                    "department_activity": dept_activity
                }
                
                # Generate tips
                tips = self._generate_tip_with_claude(data, "admin")
                
            except Exception as e:
                print(f"Error getting admin stats: {e}")
                # Generate basic admin tips
                tips = self._generate_rule_based_tips({}, "admin")
        
        # Enrich tips with related content
        for tip in tips:
            context = tip.get('context', '')
            related_content = self._get_related_content(context)
            
            if related_content:
                tip['related_content'] = related_content
        
        return tips
    
    def generate_tips_for_class(self, department_id: int = None, subject: str = None) -> Dict[str, Any]:
        """
        Generate insights about a class or department for faculty
        
        Args:
            department_id: Department ID filter
            subject: Subject filter
            
        Returns:
            Dictionary with class insights
        """
        # Set up query filters
        filters = []
        if department_id:
            filters.append(f"q.department_id = {department_id}")
        
        if subject:
            filters.append(f"q.subject = '{subject}'")
        
        filter_clause = " AND ".join(filters)
        filter_clause = f"WHERE {filter_clause}" if filter_clause else ""
        
        # Get quiz data for the class
        query = f"""
        SELECT 
            qa.id, qa.quiz_id, qa.student_id, qa.score, qa.answers, qa.feedback,
            qa.completed_at, q.subject, q.difficulty, q.questions,
            u.first_name, u.last_name, u.role
        FROM 
            il_quiz_attempts qa
        JOIN 
            il_quizzes q ON qa.quiz_id = q.id
        JOIN 
            users u ON qa.student_id = u.id
        {filter_clause}
        ORDER BY qa.completed_at DESC
        """
        
        try:
            quiz_data = pd.read_sql(query, self.db_connection)
            
            # Analyze class performance
            class_analysis = self._analyze_class_performance(quiz_data)
            
            # Get engagement metrics for the class
            engagement_query = f"""
            SELECT 
                ue.user_id, ue.count, ue.stars_earned,
                u.first_name, u.last_name
            FROM 
                user_engagement ue
            JOIN 
                users u ON ue.user_id = u.id
            WHERE 
                u.role = 'student'
                {f'AND u.department_id = {department_id}' if department_id else ''}
            """
            
            engagement_df = pd.read_sql(engagement_query, self.db_connection)
            
            # Calculate average engagement
            avg_engagement = engagement_df['count'].mean() if not engagement_df.empty else 0
            
            # Combine the insights
            insights = {
                **class_analysis,
                "average_engagement": avg_engagement,
                "total_students": len(engagement_df) if not engagement_df.empty else 0
            }
            
            return insights
            
        except Exception as e:
            print(f"Error generating class insights: {e}")
            return {}
    
    def generate_system_overview(self) -> Dict[str, Any]:
        """
        Generate system-wide insights for administrators
        
        Returns:
            Dictionary with system insights
        """
        try:
            # Get overall statistics
            stats_query = """
            SELECT
                (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
                (SELECT COUNT(*) FROM il_quiz_attempts) as total_quizzes,
                (SELECT COUNT(*) FROM il_forum_posts) as total_posts,
                (SELECT COUNT(*) FROM il_poll_votes) as total_votes,
                (SELECT COUNT(*) FROM il_note_contributions) as total_notes
            """
            stats_df = pd.read_sql(stats_query, self.db_connection)
            stats = stats_df.iloc[0].to_dict() if not stats_df.empty else {}
            
            # Get department activity
            dept_query = """
            SELECT 
                d.name, 
                COUNT(u.id) as user_count,
                (
                    SELECT COUNT(*) FROM engagement_history eh 
                    JOIN users u2 ON eh.user_id = u2.id 
                    WHERE u2.department_id = d.id
                ) as interaction_count
            FROM 
                departments d
            LEFT JOIN 
                users u ON u.department_id = d.id
            GROUP BY 
                d.name
            """
            dept_df = pd.read_sql(dept_query, self.db_connection)
            
            dept_activity = []
            for _, row in dept_df.iterrows():
                dept_activity.append({
                    "name": row['name'],
                    "user_count": row['user_count'],
                    "interaction_count": row['interaction_count'],
                    "avg_per_user": row['interaction_count'] / row['user_count'] if row['user_count'] > 0 else 0
                })
            
            # Get recent activity trend (last 7 days)
            trend_query = """
            SELECT 
                DATE(created_at) as date, 
                COUNT(*) as activity_count
            FROM 
                engagement_history
            WHERE 
                created_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY 
                DATE(created_at)
            ORDER BY 
                date
            """
            trend_df = pd.read_sql(trend_query, self.db_connection)
            
            # Format trend data
            trend_data = {}
            for _, row in trend_df.iterrows():
                trend_data[str(row['date'])] = row['activity_count']
            
            # Combine everything
            overview = {
                "statistics": stats,
                "department_activity": dept_activity,
                "activity_trend": trend_data
            }
            
            return overview
            
        except Exception as e:
            print(f"Error generating system overview: {e}")
            return {}