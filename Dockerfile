FROM node:14

# Set working directory
WORKDIR /app

# Copy application code
COPY . .

# Install dependencies
RUN npm install

# Expose the application port
EXPOSE 3000

# Set environment variables
ENV MONGODB_URI=mongodb+srv://checkinassist:0BfwPFfx2gcT63co@checkin.g7pcd5q.mongodb.net/?retryWrites=true&w=majority&appName=CheckIn
ENV TELEGRAM_BOT_TOKEN=7257553550:AAGQZBIxTnM6p9vlQm7LzJF8TnAT_tLuS_s
ENV CHECKIN_RATE="0.15"
ENV MONGODB_URI= mongodb+srv://checkinassist:0BfwPFfx2gcT63co@checkin.g7pcd5q.mongodb.net/?retryWrites=true&w=majority&appName=CheckIn
ENV FTP_HOST = f32-preview.awardspace.net
ENV FTP_USER = 4401494
ENV FTP_PASS = Blessing24/8

# Start the application
CMD ["npm", "start"]
