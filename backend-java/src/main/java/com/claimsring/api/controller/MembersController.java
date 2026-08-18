package com.claimsring.api.controller;

import java.util.ArrayList;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.claimsring.api.domain.Member;
import com.claimsring.api.domain.MemberDetail;
import com.claimsring.api.domain.NetworkGraph;
import com.claimsring.api.exception.ApiException;
import com.claimsring.api.repository.MemberRepository;
import com.claimsring.api.repository.NetworkRepository;

@RestController
@RequestMapping("/api/members")
public class MembersController {

    private final MemberRepository memberRepository;
    private final NetworkRepository networkRepository;

    public MembersController(MemberRepository memberRepository, NetworkRepository networkRepository) {
        this.memberRepository = memberRepository;
        this.networkRepository = networkRepository;
    }

    @GetMapping
    public List<Member> searchMembers(@RequestParam(name = "search", required = false, defaultValue = "") String search) {
        if (search.trim().isEmpty()) {
            return new ArrayList<>();
        }
        return memberRepository.searchMembers(search.trim(), 25);
    }

    @GetMapping("/{id}")
    public MemberDetail getMember(@PathVariable String id) {
        MemberDetail detail = memberRepository.getMemberById(id);
        if (detail == null) {
            throw new ApiException(404, "No member found with id " + id + ".");
        }
        var connections = memberRepository.getSharedIdentityConnections(id);
        return new MemberDetail(detail.member(), detail.policies(), detail.claims(), connections);
    }

    @GetMapping("/{id}/network")
    public NetworkGraph getMemberNetwork(@PathVariable String id,
            @RequestParam(name = "hops", required = false, defaultValue = "2") int hops) {
        NetworkGraph graph = networkRepository.getMemberNetwork(id, hops);
        if (graph == null) {
            throw new ApiException(404, "No member found with id " + id + ".");
        }
        return graph;
    }
}
