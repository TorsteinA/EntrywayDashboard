FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

ENV PORT=3000
ENV LAT="59.9550"
ENV LON="11.0500"
ENV STOP_PLACE_ID="NSR:StopPlace:58211"
ENV USER_AGENT="MyEntryDashboard/1.0 (admin@local.home)"
ENV ET_CLIENT_NAME="myhome-entrykiosk"

CMD ["npm", "start"]