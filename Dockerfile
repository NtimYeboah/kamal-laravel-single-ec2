# Use PHP-FPM as the base image
FROM php:8.3-fpm

# Install dependencies and nginx
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    curl \
    zip \
    unzip \
    vim \
    libzip-dev \
    libpng-dev \
    libpq-dev \
    nodejs \
    npm \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/local/bin/composer

ENV COMPOSER_ALLOW_SUPERUSER=1

# Install required php packages
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/

RUN chmod +x /usr/local/bin/install-php-extensions; \
    install-php-extensions mysqli mysqlnd pdo pdo_mysql zip

# Create a directory for your application
WORKDIR /var/www/html

COPY . .

# Run composer install for production and give permissions
RUN sed 's_@php artisan package:discover_/bin/true_;' -i composer.json \
    && composer install --ignore-platform-req=php --no-dev --optimize-autoloader \
    && composer clear-cache \
    && php artisan package:discover --ansi \
    && chown -R www-data:www-data storage \
    && chmod -R 775 storage \
    && cd storage/logs \
    && touch laravel.log \
    && chmod 777 /var/www/html/storage/logs/laravel.log \
    && mkdir -p  /var/www/html/storage/framework/sessions  /var/www/html/storage/framework/views storage/framework/cache/data

# Configure nginx to work with php-fpm
COPY ./scripts/default.conf /etc/nginx/sites-available/default

# Set up supervisor to run both nginx and php-fpm
RUN mkdir -p /var/log/supervisor
COPY ./scripts/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose port 80
EXPOSE 80

# Copy entrypoint
COPY ./scripts/entrypoint /usr/local/bin/php-entrypoint

# Give permisisons to everything in bin/
RUN chmod a+x /usr/local/bin/*

ENTRYPOINT ["/usr/local/bin/php-entrypoint"]
