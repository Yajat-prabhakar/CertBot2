import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { feedbackSchema } from '../lib/validation';
import { submitFeedback } from '../lib/api';
import StarRating from './StarRating';
import SuccessMessage from './SuccessMessage';

export default function FeedbackForm({ eventName }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      event: eventName,
      rating: 0,
    },
  });

  const watchedRating = watch('rating');
  const watchedFeedback = watch('feedback', '');

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await submitFeedback(data);
      setSubmittedEmail(data.email);
      setIsSuccess(true);
    } catch (error) {
      setSubmitError(error.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSuccess(false);
    setSubmittedEmail('');
    reset();
  };

  if (isSuccess) {
    return <SuccessMessage email={submittedEmail} onReset={handleReset} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-8 animate-fadeInUp">
          <div className="inline-block bg-indigo-100 text-indigo-800 px-4 py-1 rounded-full text-sm font-semibold mb-4">
            Event Feedback
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
            {eventName}
          </h1>
          <p className="text-lg text-gray-600">
            Share your feedback and get your certificate delivered instantly
          </p>
        </div>

        {/* Error Alert */}
        {submitError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded animate-fadeInUp">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Full Name */}
          <div className="animate-fadeInUp animate-delay-100">
            <label htmlFor="name" className="label">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              {...register('name')}
              className="input-field"
              placeholder="Enter your full name"
              disabled={isSubmitting}
            />
            {errors.name && <p className="error-text">{errors.name.message}</p>}
          </div>

          {/* Email */}
          <div className="animate-fadeInUp animate-delay-200">
            <label htmlFor="email" className="label">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className="input-field"
              placeholder="you@example.com"
              disabled={isSubmitting}
            />
            {errors.email && <p className="error-text">{errors.email.message}</p>}
            <p className="text-xs text-gray-500 mt-1">
              Your certificate will be sent to this email
            </p>
          </div>

          {/* Star Rating */}
          <div className="animate-fadeInUp animate-delay-300">
            <StarRating
              value={watchedRating}
              onChange={(value) => setValue('rating', value, { shouldValidate: true })}
              error={errors.rating?.message}
            />
          </div>

          {/* Feedback */}
          <div className="animate-fadeInUp animate-delay-300">
            <label htmlFor="feedback" className="label">
              Your Feedback <span className="text-red-500">*</span>
            </label>
            <textarea
              id="feedback"
              {...register('feedback')}
              rows={4}
              className="input-field resize-none"
              placeholder="Share your experience with us..."
              disabled={isSubmitting}
            />
            <div className="flex justify-between items-center mt-1">
              {errors.feedback ? (
                <p className="error-text">{errors.feedback.message}</p>
              ) : (
                <p className="text-xs text-gray-500">Minimum 10 characters</p>
              )}
              <p className="text-xs text-gray-500">
                {watchedFeedback.length}/500
              </p>
            </div>
          </div>

          {/* What did you enjoy most */}
          <div className="animate-fadeInUp animate-delay-300">
            <label htmlFor="enjoyed_most" className="label">
              What did you enjoy most? <span className="text-gray-400">(Optional)</span>
            </label>
            <textarea
              id="enjoyed_most"
              {...register('enjoyed_most')}
              rows={3}
              className="input-field resize-none"
              placeholder="Tell us what you liked..."
              disabled={isSubmitting}
            />
            {errors.enjoyed_most && <p className="error-text">{errors.enjoyed_most.message}</p>}
          </div>

          {/* Suggestions */}
          <div className="animate-fadeInUp animate-delay-300">
            <label htmlFor="suggestions" className="label">
              Suggestions for improvement <span className="text-gray-400">(Optional)</span>
            </label>
            <textarea
              id="suggestions"
              {...register('suggestions')}
              rows={3}
              className="input-field resize-none"
              placeholder="How can we improve?"
              disabled={isSubmitting}
            />
            {errors.suggestions && <p className="error-text">{errors.suggestions.message}</p>}
          </div>

          {/* Submit Button */}
          <div className="pt-4 animate-fadeInUp animate-delay-300">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full text-lg flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending Certificate...
                </>
              ) : (
                <>
                  Submit & Get Certificate
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
