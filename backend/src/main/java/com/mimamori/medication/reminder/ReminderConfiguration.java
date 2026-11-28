package com.mimamori.medication.reminder;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.boot.quartz.autoconfigure.SchedulerFactoryBeanCustomizer;
import org.springframework.scheduling.quartz.SpringBeanJobFactory;

@Configuration
public class ReminderConfiguration {
    @Bean
    SchedulerFactoryBeanCustomizer reminderJobFactory(AutowireCapableBeanFactory beans) {
        return factory -> factory.setJobFactory(new SpringBeanJobFactory() {
            @Override
            protected Object createJobInstance(org.quartz.spi.TriggerFiredBundle bundle) throws Exception {
                Object job = super.createJobInstance(bundle);
                beans.autowireBean(job);
                return job;
            }
        });
    }
}
