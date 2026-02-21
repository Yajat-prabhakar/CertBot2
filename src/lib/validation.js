import { z } from 'zod';

export const feedbackSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\u00C0-\u017F'-]+$/, 'Name contains invalid characters'),
  
  email: z.string()
    .email('Please enter a valid email address'),
  
  event: z.string()
    .min(1, 'Event name is required'),
  
  rating: z.number({
    required_error: 'Please provide a rating',
    invalid_type_error: 'Please provide a rating',
  })
    .int()
    .min(1, 'Please select at least 1 star')
    .max(5, 'Rating cannot exceed 5 stars'),
  
  feedback: z.string()
    .min(10, 'Feedback must be at least 10 characters')
    .max(500, 'Feedback must be less than 500 characters'),
  
  enjoyed_most: z.string()
    .max(300, 'Please keep this under 300 characters')
    .optional()
    .or(z.literal('')),
  
  suggestions: z.string()
    .max(300, 'Please keep this under 300 characters')
    .optional()
    .or(z.literal('')),
});
