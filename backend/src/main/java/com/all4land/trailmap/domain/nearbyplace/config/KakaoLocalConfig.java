package com.all4land.trailmap.domain.nearbyplace.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
@EnableConfigurationProperties(KakaoLocalProperties.class)
public class KakaoLocalConfig {

    @Bean("kakaoRestClient")
    public RestClient kakaoRestClient(KakaoLocalProperties properties) {
        var httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .build();
        var requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        return RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "KakaoAK " + properties.restApiKey())
                .build();
    }

    @Bean(name = "kakaoSearchExecutor", destroyMethod = "shutdown")
    public ExecutorService kakaoSearchExecutor(KakaoLocalProperties properties) {
        return Executors.newFixedThreadPool(properties.maxConcurrentRequests(),
                Thread.ofPlatform().name("kakao-local-", 0).factory());
    }
}
