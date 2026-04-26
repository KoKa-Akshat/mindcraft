import random
from datetime import timedelta

from .synthetic_student import SyntheticStudent


def generate_study_trajectory(student: SyntheticStudent, days: int, sessions_per_week: int):
    """
    Generate a study trajectory for the given student over the specified number of days.
    """
    events = []
    current_time = student._current_time

    for day in range(days):
        # Probability of a session per day
        if random.random() < sessions_per_week / 7:
            # Choose a random concept to practice
            concept = random.choice(student.ontology.concepts)
            event_type = random.choice(["session", "flashcard", "worksheet", "problem_set"])
            
            # Practice and get the event
            event = student.practice(concept.id, event_type)
            events.append(event)
        
        # Advance time by 1 day
        student.advance_time(1)
    
    return events