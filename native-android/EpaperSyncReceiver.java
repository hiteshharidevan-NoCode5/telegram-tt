package com.custom.telegramweb;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import java.util.Calendar;

public class EpaperSyncReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        if (hour >= 6 && hour <= 12) {
            Intent launch = new Intent(context, MainActivity.class);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launch.putExtra("epaper_sync", true);
            context.startActivity(launch);
        }
        scheduleMorningAlarms(context);
    }

    public static void scheduleMorningAlarms(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Calendar now = Calendar.getInstance();
        Calendar next = Calendar.getInstance();
        next.set(Calendar.MINUTE, 2);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (!next.after(now)) {
            next.add(Calendar.HOUR_OF_DAY, 1);
        }
        int h = next.get(Calendar.HOUR_OF_DAY);
        if (h < 6) {
            next.set(Calendar.HOUR_OF_DAY, 6);
        } else if (h > 12) {
            next.add(Calendar.DAY_OF_YEAR, 1);
            next.set(Calendar.HOUR_OF_DAY, 6);
        }
        Intent i = new Intent(context, EpaperSyncReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getBroadcast(context, 6012, i, flags);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
    }
}
