import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { AppError } from './error';

export const validate = (schema: ZodSchema) => 
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (!result.success) {
        throw new AppError(
          'Validation failed',
          400,
          'VALIDATION_ERROR',
          result.error.format()
        );
      }

      // Replace request data with validated data
      req.body = result.data.body || {};
      req.query = result.data.query || {};
      req.params = result.data.params || {};

      next();
    } catch (error) {
      next(error);
    }
  };

export const validateBody = (schema: ZodSchema) => 
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        throw new AppError(
          'Invalid request body',
          400,
          'INVALID_BODY',
          result.error.format()
        );
      }

      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };

export const validateQuery = (schema: ZodSchema) => 
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        throw new AppError(
          'Invalid query parameters',
          400,
          'INVALID_QUERY',
          result.error.format()
        );
      }

      req.query = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };

export const validateParams = (schema: ZodSchema) => 
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        throw new AppError(
          'Invalid URL parameters',
          400,
          'INVALID_PARAMS',
          result.error.format()
        );
      }

      req.params = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
